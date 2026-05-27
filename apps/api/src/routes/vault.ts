/**
 * Vault routes — BYOK key operations gated by internal/admin tokens.
 *
 * Two surfaces:
 *
 * 1. Internal (`/v1/internal/vault/*`) — called by the Python scan worker
 *    to decrypt a customer key just-in-time before invoking a provider.
 *    Gated by INTERNAL_SERVICE_TOKEN. The master key never leaves this
 *    process; only the resulting plaintext crosses the wire, over TLS
 *    inside the private network.
 *
 * 2. Admin (`/v1/admin/vault/*`) — called by the daily cron to validate
 *    every stored key. Gated by ADMIN_API_TOKEN. Updates is_valid +
 *    last_validated_at + writes audit rows.
 *
 * User-facing vault management (add / list / delete) lives in apps/web as
 * Server Actions, since Clerk session resolution is already wired there
 * via `getCurrentClerkContext`. This file does NOT expose user-facing
 * mutation endpoints — that would require duplicating the Clerk handshake.
 */

import {
  createDatabase,
  KeyVaultService,
  loadMasterKey,
  withClerkAuth,
  type ClerkAuthContext,
  type Database,
  type SqlClient,
} from '@geosight/db';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { env } from '../env.js';
import { validateKey } from '../services/key-validators.js';

type VaultRoutesOptions = {
  db?: Database;
  sql?: SqlClient;
};

const providerSchema = z.enum(['openai', 'gemini', 'perplexity']);

const decryptBodySchema = z.object({
  orgId: z.string().uuid(),
  /** Internal users.id (UUID) used as the actor for audit logging. The Python
   * worker passes the user that scheduled the scan, or null for cron jobs. */
  actorUserId: z.string().uuid().nullable().optional().default(null),
  provider: providerSchema,
});

const validateAllBodySchema = z.object({
  /** Optional org filter — defaults to validating every key in the system. */
  orgId: z.string().uuid().optional(),
});

function requireInternalToken(req: FastifyRequest): boolean {
  if (!env.INTERNAL_SERVICE_TOKEN) return false;
  const header = req.headers['x-internal-token'];
  return header === env.INTERNAL_SERVICE_TOKEN;
}

function requireAdminToken(req: FastifyRequest): boolean {
  if (!env.ADMIN_API_TOKEN) return false;
  return req.headers['x-admin-token'] === env.ADMIN_API_TOKEN;
}

/** Build a service-role ClerkAuthContext for internal operations. RLS still
 * applies — we pin the org/user explicitly so audit rows attribute correctly. */
function internalContext(orgId: string, actorUserId: string | null): ClerkAuthContext {
  return {
    claims: {
      user_id: actorUserId ?? orgId, // any UUID; only used to satisfy withClerkAuth's non-empty check
      org_id: orgId,
      org_role: 'owner',
    },
  };
}

export const vaultRoutes: FastifyPluginAsync<VaultRoutesOptions> = async (app, options) => {
  /**
   * POST /v1/internal/vault/decrypt
   * Body: { orgId, actorUserId?, provider }
   * Returns: { plaintext }
   *
   * The Python scan worker calls this once per (org, provider) per scan run.
   * Latency is ~10ms; provider calls take 500-2000ms, so the round-trip is
   * negligible compared to the security benefit of centralizing decryption.
   */
  app.post('/internal/vault/decrypt', async (req, reply) => {
    if (!requireInternalToken(req)) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    if (!env.KEY_VAULT_MASTER_KEY) {
      return reply.code(503).send({ error: 'VaultUnavailable', detail: 'master key not configured' });
    }
    if (!options.db && !env.DATABASE_URL) {
      return reply.code(503).send({ error: 'DatabaseUnavailable' });
    }

    const parsed = decryptBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'InvalidPayload',
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const owned = options.db
      ? null
      : createDatabase({ url: env.DATABASE_URL!, max: 2 });
    const db = options.db ?? owned!.db;

    try {
      const master = loadMasterKey(env.KEY_VAULT_MASTER_KEY);
      const vault = new KeyVaultService(master);
      const ctx = internalContext(parsed.data.orgId, parsed.data.actorUserId ?? null);

      const plaintext = await withClerkAuth(db, ctx, (tx) =>
        vault.getDecryptedKey(
          tx,
          {
            orgId: parsed.data.orgId,
            actorClerkUserId: null, // internal call — no Clerk user
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] ?? null,
          },
          parsed.data.provider,
        ),
      );

      if (!plaintext) {
        return reply.code(404).send({ error: 'KeyNotFound' });
      }

      return reply.send({ ok: true, plaintext });
    } catch (err) {
      req.log.error({ err }, 'vault: decrypt failed');
      return reply.code(500).send({ error: 'DecryptFailed' });
    } finally {
      if (owned) await owned.sql.end({ timeout: 5 });
    }
  });

  /**
   * POST /v1/admin/vault/validate-all
   * Body: { orgId? }
   * Iterates every (org, provider) tuple in api_keys_vault, runs the live
   * validator, and updates is_valid + last_validated_at. Used by the daily
   * cron — Phase 3 W15.
   *
   * NOTE: this endpoint scaffolds the cron entry-point but the full
   * BullMQ-scheduled job + low-balance alert remain TODO (W15).
   */
  app.post('/admin/vault/validate-all', async (req, reply) => {
    if (!requireAdminToken(req)) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    if (!env.KEY_VAULT_MASTER_KEY) {
      return reply.code(503).send({ error: 'VaultUnavailable' });
    }
    if (!options.db && !env.DATABASE_URL) {
      return reply.code(503).send({ error: 'DatabaseUnavailable' });
    }

    const parsed = validateAllBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'InvalidPayload',
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const owned = options.db
      ? null
      : createDatabase({ url: env.DATABASE_URL!, max: 2 });
    const db = options.db ?? owned!.db;

    try {
      const master = loadMasterKey(env.KEY_VAULT_MASTER_KEY);
      const vault = new KeyVaultService(master);

      // Service-role read of the full vault — bypasses RLS by reading without
      // a Clerk transaction. We trust the admin token to gate this surface.
      const rows = await db.query.apiKeysVault.findMany({
        where: parsed.data.orgId
          ? (apiKeysVault, { eq }) => eq(apiKeysVault.orgId, parsed.data.orgId!)
          : undefined,
      });

      const results: Array<{
        orgId: string;
        provider: string;
        valid: boolean;
        reason: string;
      }> = [];

      for (const row of rows) {
        const ctx = internalContext(row.orgId, null);
        try {
          const plaintext = await withClerkAuth(db, ctx, (tx) =>
            vault.getDecryptedKey(
              tx,
              {
                orgId: row.orgId,
                actorClerkUserId: null,
                ipAddress: req.ip,
                userAgent: 'vault-validate-cron',
              },
              row.provider,
            ),
          );
          if (!plaintext) {
            results.push({ orgId: row.orgId, provider: row.provider, valid: false, reason: 'missing' });
            continue;
          }
          const probe = await validateKey(row.provider, plaintext);
          await withClerkAuth(db, ctx, (tx) =>
            vault.markValidated(
              tx,
              {
                orgId: row.orgId,
                actorClerkUserId: null,
                ipAddress: req.ip,
                userAgent: 'vault-validate-cron',
              },
              row.provider,
              probe.valid,
              probe.reason,
            ),
          );
          results.push({
            orgId: row.orgId,
            provider: row.provider,
            valid: probe.valid,
            reason: probe.reason,
          });
        } catch (err) {
          req.log.error({ err, orgId: row.orgId, provider: row.provider }, 'vault: validate failed');
          results.push({
            orgId: row.orgId,
            provider: row.provider,
            valid: false,
            reason: 'error',
          });
        }
      }

      return reply.send({ ok: true, checked: results.length, results });
    } finally {
      if (owned) await owned.sql.end({ timeout: 5 });
    }
  });
};
