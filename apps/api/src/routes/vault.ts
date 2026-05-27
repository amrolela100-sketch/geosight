/**
 * Vault routes: internal BYOK decryption plus admin validation.
 *
 * User-facing vault management lives in apps/web Server Actions, where Clerk
 * session resolution is already wired. This API file only exposes token-gated
 * operational surfaces.
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
import type { QueueRegistry } from '../queues/registry.js';
import { runVaultValidationJob, VaultValidationUnavailableError } from '../vault/validation.js';

type VaultRoutesOptions = {
  db?: Database;
  sql?: SqlClient;
  queues?: QueueRegistry;
};

const providerSchema = z.enum(['openai', 'gemini', 'perplexity']);

const decryptBodySchema = z.object({
  orgId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable().optional().default(null),
  provider: providerSchema,
});

const validateAllBodySchema = z.object({
  orgId: z.string().uuid().optional(),
  enqueueAlerts: z.boolean().default(true),
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

function internalContext(orgId: string, actorUserId: string | null): ClerkAuthContext {
  return {
    claims: {
      user_id: actorUserId ?? orgId,
      org_id: orgId,
      org_role: 'owner',
    },
  };
}

export const vaultRoutes: FastifyPluginAsync<VaultRoutesOptions> = async (app, options) => {
  app.post('/internal/vault/decrypt', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('Pragma', 'no-cache');

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

    const owned = options.db ? null : createDatabase({ url: env.DATABASE_URL!, max: 2 });
    const db = options.db ?? owned!.db;

    try {
      const vault = new KeyVaultService(loadMasterKey(env.KEY_VAULT_MASTER_KEY));
      const ctx = internalContext(parsed.data.orgId, parsed.data.actorUserId ?? null);

      const plaintext = await withClerkAuth(db, ctx, (tx) =>
        vault.getDecryptedKey(
          tx,
          {
            orgId: parsed.data.orgId,
            actorClerkUserId: null,
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

  app.post('/admin/vault/validate-all', async (req, reply) => {
    if (!requireAdminToken(req)) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const parsed = validateAllBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'InvalidPayload',
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await runVaultValidationJob({
        db: options.db,
        sql: options.sql,
        orgId: parsed.data.orgId,
        enqueueAlerts: parsed.data.enqueueAlerts,
        alertQueue: options.queues?.get('alert:send') ?? null,
        ipAddress: req.ip,
        userAgent: 'vault-validate-admin',
      });

      return reply.send({ ok: true, ...result });
    } catch (err) {
      if (err instanceof VaultValidationUnavailableError) {
        return reply.code(503).send({ error: err.code });
      }
      req.log.error({ err }, 'vault: validate-all failed');
      return reply.code(500).send({ error: 'ValidationFailed' });
    }
  });
};
