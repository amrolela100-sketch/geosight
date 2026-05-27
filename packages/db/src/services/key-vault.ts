/**
 * KeyVaultService — Bring-Your-Own-Key (BYOK) secret storage.
 *
 * Per the BYOK-from-day-one decision, GeoSight never holds plaintext provider
 * API keys at rest. Customer keys are encrypted with AES-256-GCM and stored
 * in `api_keys_vault`. The master key lives only in process env (api +
 * Next.js server-only) and is rotated by redeploy.
 *
 * Every operation that touches a key (encrypt, decrypt, delete, validate)
 * MUST write an `audit_logs` row inside the same transaction so we can never
 * decrypt without leaving a trail. Callers run this service inside
 * `withClerkAuth(...)` so RLS scopes reads/writes to the active org.
 */

import { and, eq } from 'drizzle-orm';
import crypto from 'node:crypto';

import type { DbTransaction } from '../client.js';
import { apiKeysVault } from '../schema/vault.js';
import { auditLogs, type NewAuditLog } from '../schema/audit.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

export type VaultProvider = 'openai' | 'gemini' | 'perplexity';

/** Opaque handle around the 32-byte master key. The Buffer is never logged. */
export interface VaultMasterKey {
  readonly bytes: Buffer;
}

/**
 * Parse the base64 master key from env. Throws — and the api refuses to
 * service vault routes — if the value is missing or the wrong length.
 */
export function loadMasterKey(b64: string | undefined): VaultMasterKey {
  if (!b64) {
    throw new Error(
      'KEY_VAULT_MASTER_KEY is unset. Generate one with `openssl rand -base64 32` and set it in the api env.',
    );
  }
  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length !== KEY_BYTES) {
    throw new Error(
      `KEY_VAULT_MASTER_KEY must decode to ${KEY_BYTES} bytes, got ${bytes.length}.`,
    );
  }
  return { bytes };
}

export interface EncryptedKeyMaterial {
  readonly encrypted: Buffer;
  readonly iv: Buffer;
  readonly authTag: Buffer;
  /** Last 4 chars of the cleartext — safe to display in UI for identification. */
  readonly lastFour: string;
}

export function encryptKey(master: VaultMasterKey, plaintext: string): EncryptedKeyMaterial {
  if (!plaintext) throw new Error('plaintext key must be non-empty');
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, master.bytes, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const lastFour = plaintext.slice(-4);
  return { encrypted, iv, authTag, lastFour };
}

export interface CipherRecord {
  readonly encryptedKey: Buffer;
  readonly iv: Buffer;
  readonly authTag: Buffer;
}

export function decryptKey(master: VaultMasterKey, record: CipherRecord): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, master.bytes, record.iv);
  decipher.setAuthTag(record.authTag);
  const plaintext = Buffer.concat([decipher.update(record.encryptedKey), decipher.final()]);
  return plaintext.toString('utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence + audit-log layer.
// ─────────────────────────────────────────────────────────────────────────────

export interface VaultActor {
  readonly orgId: string;
  readonly actorClerkUserId: string | null;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
}

export type VaultAuditAction =
  | 'vault.key.created'
  | 'vault.key.decrypted'
  | 'vault.key.deleted'
  | 'vault.key.rotated'
  | 'vault.key.validated';

async function writeAudit(
  tx: DbTransaction,
  actor: VaultActor,
  action: VaultAuditAction,
  vaultId: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  const row: NewAuditLog = {
    orgId: actor.orgId,
    actorClerkUserId: actor.actorClerkUserId,
    action,
    entityRef: vaultId ? `vault_key:${vaultId}` : null,
    metadata,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
  };
  await tx.insert(auditLogs).values(row);
}

export interface StoreKeyInput {
  readonly provider: VaultProvider;
  readonly plaintext: string;
  readonly label?: string | null;
}

export interface StoredKeySummary {
  readonly id: string;
  readonly provider: VaultProvider;
  readonly lastFour: string;
  readonly label: string | null;
  readonly isValid: boolean;
  readonly lastValidatedAt: Date | null;
  readonly createdAt: Date;
}

export class KeyVaultService {
  constructor(private readonly master: VaultMasterKey) {}

  /** Encrypt + upsert + audit. One row per (org, provider). */
  async storeKey(
    tx: DbTransaction,
    actor: VaultActor,
    input: StoreKeyInput,
  ): Promise<StoredKeySummary> {
    const material = encryptKey(this.master, input.plaintext);
    const [row] = await tx
      .insert(apiKeysVault)
      .values({
        orgId: actor.orgId,
        provider: input.provider,
        encryptedKey: material.encrypted,
        iv: material.iv,
        authTag: material.authTag,
        lastFour: material.lastFour,
        label: input.label ?? null,
        isValid: true,
      })
      .onConflictDoUpdate({
        target: [apiKeysVault.orgId, apiKeysVault.provider],
        set: {
          encryptedKey: material.encrypted,
          iv: material.iv,
          authTag: material.authTag,
          lastFour: material.lastFour,
          label: input.label ?? null,
          isValid: true,
          lastValidatedAt: null,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!row) throw new Error('vault: insert returned no row');

    await writeAudit(tx, actor, 'vault.key.created', row.id, {
      provider: input.provider,
      lastFour: material.lastFour,
    });

    return summary(row);
  }

  /** Decrypt + audit. Returns null when the org has no key for this provider. */
  async getDecryptedKey(
    tx: DbTransaction,
    actor: VaultActor,
    provider: VaultProvider,
  ): Promise<string | null> {
    const row = await tx.query.apiKeysVault.findFirst({
      where: and(eq(apiKeysVault.orgId, actor.orgId), eq(apiKeysVault.provider, provider)),
    });
    if (!row) return null;

    const plaintext = decryptKey(this.master, {
      encryptedKey: row.encryptedKey,
      iv: row.iv,
      authTag: row.authTag,
    });

    await writeAudit(tx, actor, 'vault.key.decrypted', row.id, {
      provider,
      lastFour: row.lastFour,
    });

    return plaintext;
  }

  /** Delete + audit. No-op if the key doesn't exist. */
  async deleteKey(
    tx: DbTransaction,
    actor: VaultActor,
    provider: VaultProvider,
  ): Promise<boolean> {
    const [row] = await tx
      .delete(apiKeysVault)
      .where(and(eq(apiKeysVault.orgId, actor.orgId), eq(apiKeysVault.provider, provider)))
      .returning({ id: apiKeysVault.id, lastFour: apiKeysVault.lastFour });
    if (!row) return false;

    await writeAudit(tx, actor, 'vault.key.deleted', row.id, {
      provider,
      lastFour: row.lastFour,
    });

    return true;
  }

  /** Update is_valid + last_validated_at after an external probe. */
  async markValidated(
    tx: DbTransaction,
    actor: VaultActor,
    provider: VaultProvider,
    isValid: boolean,
    note?: string,
  ): Promise<void> {
    const [row] = await tx
      .update(apiKeysVault)
      .set({ isValid, lastValidatedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(apiKeysVault.orgId, actor.orgId), eq(apiKeysVault.provider, provider)))
      .returning({ id: apiKeysVault.id, lastFour: apiKeysVault.lastFour });
    if (!row) return;

    await writeAudit(tx, actor, 'vault.key.validated', row.id, {
      provider,
      isValid,
      note: note ?? null,
    });
  }

  /** List keys for the org, never returning plaintext. */
  async listKeys(tx: DbTransaction, actor: VaultActor): Promise<StoredKeySummary[]> {
    const rows = await tx.query.apiKeysVault.findMany({
      where: eq(apiKeysVault.orgId, actor.orgId),
    });
    return rows.map(summary);
  }
}

type VaultRow = {
  id: string;
  provider: VaultProvider;
  lastFour: string;
  label: string | null;
  isValid: boolean;
  lastValidatedAt: Date | null;
  createdAt: Date;
};

function summary(row: VaultRow): StoredKeySummary {
  return {
    id: row.id,
    provider: row.provider,
    lastFour: row.lastFour,
    label: row.label,
    isValid: row.isValid,
    lastValidatedAt: row.lastValidatedAt,
    createdAt: row.createdAt,
  };
}
