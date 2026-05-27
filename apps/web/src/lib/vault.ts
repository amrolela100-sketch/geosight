import 'server-only';

import { KeyVaultService, loadMasterKey, type VaultMasterKey } from '@geosight/db';

import { env } from './env';

export class VaultUnavailableError extends Error {
  readonly code = 'VAULT_UNAVAILABLE' as const;
  constructor(message = 'KEY_VAULT_MASTER_KEY is not configured on this deployment.') {
    super(message);
  }
}

let cached: { master: VaultMasterKey; service: KeyVaultService } | null = null;

/** Lazy-load the master key and instantiate the vault service. Throws
 * VaultUnavailableError when the env var is missing — callers convert this
 * into a user-friendly error state instead of a 500. */
export function getKeyVaultService(): KeyVaultService {
  if (cached) return cached.service;

  if (!env.KEY_VAULT_MASTER_KEY) {
    throw new VaultUnavailableError();
  }

  const master = loadMasterKey(env.KEY_VAULT_MASTER_KEY);
  const service = new KeyVaultService(master);
  cached = { master, service };
  return service;
}
