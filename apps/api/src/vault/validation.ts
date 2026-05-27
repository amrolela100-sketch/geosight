import {
  createDatabase,
  KeyVaultService,
  loadMasterKey,
  validateKey,
  withClerkAuth,
  type ClerkAuthContext,
  type Database,
  type SqlClient,
  type VaultProvider,
} from '@geosight/db';
import type { Queue } from 'bullmq';

import { env } from '../env.js';

export type VaultValidationResult = {
  orgId: string;
  provider: VaultProvider;
  valid: boolean;
  reason: string;
};

export type RunVaultValidationOptions = {
  db?: Database;
  sql?: SqlClient;
  databaseUrl?: string;
  masterKey?: string;
  orgId?: string;
  enqueueAlerts?: boolean;
  alertQueue?: Queue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type RunVaultValidationResult = {
  checked: number;
  invalid: number;
  alertsQueued: number;
  results: VaultValidationResult[];
};

export class VaultValidationUnavailableError extends Error {
  constructor(
    readonly code: 'VaultUnavailable' | 'DatabaseUnavailable',
    message: string,
  ) {
    super(message);
  }
}

function internalContext(orgId: string): ClerkAuthContext {
  return {
    claims: {
      user_id: orgId,
      org_id: orgId,
      org_role: 'owner',
    },
  };
}

function shouldAlert(reason: string): boolean {
  return reason === 'unauthorized' || reason === 'forbidden' || reason === 'rate_limited';
}

function alertKind(reason: string): 'vault_key_invalid' | 'vault_key_rate_limited' {
  return reason === 'rate_limited' ? 'vault_key_rate_limited' : 'vault_key_invalid';
}

function alertSeverity(reason: string): 'warning' | 'critical' {
  return reason === 'rate_limited' ? 'warning' : 'critical';
}

async function enqueueInvalidKeyAlert(
  queue: Queue | null | undefined,
  result: VaultValidationResult,
): Promise<boolean> {
  if (!queue || !shouldAlert(result.reason)) return false;

  await queue.add('alert:send', {
    organizationId: result.orgId,
    kind: alertKind(result.reason),
    provider: result.provider,
    channel: 'email',
    severity: alertSeverity(result.reason),
    message: `BYOK ${result.provider} key validation failed: ${result.reason}`,
    metadata: {
      provider: result.provider,
      reason: result.reason,
      source: 'vault-validation',
    },
  });

  return true;
}

export async function runVaultValidationJob(
  options: RunVaultValidationOptions,
): Promise<RunVaultValidationResult> {
  const masterKey = options.masterKey ?? env.KEY_VAULT_MASTER_KEY;
  if (!masterKey) {
    throw new VaultValidationUnavailableError(
      'VaultUnavailable',
      'KEY_VAULT_MASTER_KEY is not configured',
    );
  }

  const databaseUrl = options.databaseUrl ?? env.DATABASE_URL;
  if (!options.db && !databaseUrl) {
    throw new VaultValidationUnavailableError('DatabaseUnavailable', 'DATABASE_URL is not configured');
  }

  const owned = options.db
    ? null
    : createDatabase({
        url: databaseUrl!,
        max: 2,
      });
  const db = options.db ?? owned!.db;

  try {
    const vault = new KeyVaultService(loadMasterKey(masterKey));
    const rows = await db.query.apiKeysVault.findMany({
      where: options.orgId
        ? (table, { eq }) => eq(table.orgId, options.orgId!)
        : undefined,
    });
    const results: VaultValidationResult[] = [];
    let alertsQueued = 0;

    for (const row of rows) {
      const ctx = internalContext(row.orgId);
      try {
        const plaintext = await withClerkAuth(db, ctx, (tx) =>
          vault.getDecryptedKey(
            tx,
            {
              orgId: row.orgId,
              actorClerkUserId: null,
              ipAddress: options.ipAddress ?? null,
              userAgent: options.userAgent ?? 'vault-validate-cron',
            },
            row.provider,
          ),
        );

        if (!plaintext) {
          const result: VaultValidationResult = {
            orgId: row.orgId,
            provider: row.provider,
            valid: false,
            reason: 'missing',
          };
          results.push(result);
          continue;
        }

        const probe = await validateKey(row.provider, plaintext);
        await withClerkAuth(db, ctx, (tx) =>
          vault.markValidated(
            tx,
            {
              orgId: row.orgId,
              actorClerkUserId: null,
              ipAddress: options.ipAddress ?? null,
              userAgent: options.userAgent ?? 'vault-validate-cron',
            },
            row.provider,
            probe.valid,
            probe.reason,
          ),
        );

        const result: VaultValidationResult = {
          orgId: row.orgId,
          provider: row.provider,
          valid: probe.valid,
          reason: probe.reason,
        };
        results.push(result);

        if (options.enqueueAlerts ?? true) {
          const queued = await enqueueInvalidKeyAlert(options.alertQueue, result);
          if (queued) alertsQueued += 1;
        }
      } catch {
        const result: VaultValidationResult = {
          orgId: row.orgId,
          provider: row.provider,
          valid: false,
          reason: 'error',
        };
        results.push(result);
      }
    }

    return {
      checked: results.length,
      invalid: results.filter((result) => !result.valid).length,
      alertsQueued,
      results,
    };
  } finally {
    if (owned) await owned.sql.end({ timeout: 5 });
  }
}
