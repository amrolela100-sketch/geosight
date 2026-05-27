'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { validateKey, type StoredKeySummary, type VaultProvider } from '@geosight/db';

import {
  NoActiveOrgError,
  UnauthorizedError,
  UserNotProvisionedError,
  getCurrentClerkContext,
  withClerkRequest,
} from '@/lib/auth';
import { VaultUnavailableError, getKeyVaultService } from '@/lib/vault';

export type VaultActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const providerSchema = z.enum(['openai', 'gemini', 'perplexity']);

const storeKeySchema = z.object({
  provider: providerSchema,
  apiKey: z.string().min(8, 'too_short').max(512, 'too_long'),
  label: z
    .string()
    .max(120, 'too_long')
    .optional()
    .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined)),
});

function revalidateSettingsPaths(): void {
  revalidatePath('/[locale]/dashboard/settings', 'page');
}

function authErrorToState(err: unknown): VaultActionState | null {
  if (err instanceof UnauthorizedError) return { ok: false, error: 'unauthorized' };
  if (err instanceof NoActiveOrgError) return { ok: false, error: 'no_active_org' };
  if (err instanceof UserNotProvisionedError) return { ok: false, error: 'user_not_provisioned' };
  if (err instanceof VaultUnavailableError) return { ok: false, error: 'vault_unavailable' };
  return null;
}

export async function listVaultKeys(): Promise<StoredKeySummary[]> {
  try {
    const vault = getKeyVaultService();
    const ctx = await getCurrentClerkContext();
    return await withClerkRequest((tx) =>
      vault.listKeys(tx, {
        orgId: ctx.claims.org_id!,
        actorClerkUserId: null,
      }),
    );
  } catch (err) {
    if (authErrorToState(err)) return [];
    throw err;
  }
}

export async function storeKeyAction(
  _prev: VaultActionState,
  formData: FormData,
): Promise<VaultActionState> {
  const parsed = storeKeySchema.safeParse({
    provider: formData.get('provider'),
    apiKey: formData.get('apiKey'),
    label: (formData.get('label') as string | null) ?? undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_failed',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const vault = getKeyVaultService();
    const ctx = await getCurrentClerkContext();

    // Validate the key before storing, so users don't save bad keys silently.
    const probe = await validateKey(parsed.data.provider, parsed.data.apiKey);
    if (!probe.valid) {
      return {
        ok: false,
        error: `validation_${probe.reason}`,
      };
    }

    await withClerkRequest((tx) =>
      vault.storeKey(
        tx,
        {
          orgId: ctx.claims.org_id!,
          actorClerkUserId: ctx.claims.user_id,
        },
        {
          provider: parsed.data.provider,
          plaintext: parsed.data.apiKey,
          label: parsed.data.label ?? null,
        },
      ),
    );

    // Mark as validated so the UI shows the green check immediately without
    // waiting for the daily cron.
    await withClerkRequest((tx) =>
      vault.markValidated(
        tx,
        {
          orgId: ctx.claims.org_id!,
          actorClerkUserId: ctx.claims.user_id,
        },
        parsed.data.provider,
        true,
        'inline-validated-on-store',
      ),
    );

    revalidateSettingsPaths();
    return { ok: true, message: 'key_stored' };
  } catch (err) {
    const authState = authErrorToState(err);
    if (authState) return authState;
    console.error('[vault.store] failed:', err);
    return { ok: false, error: 'internal_error' };
  }
}

export async function deleteKeyAction(provider: VaultProvider): Promise<VaultActionState> {
  const providerCheck = providerSchema.safeParse(provider);
  if (!providerCheck.success) return { ok: false, error: 'invalid_provider' };

  try {
    const vault = getKeyVaultService();
    const ctx = await getCurrentClerkContext();
    const deleted = await withClerkRequest((tx) =>
      vault.deleteKey(
        tx,
        {
          orgId: ctx.claims.org_id!,
          actorClerkUserId: ctx.claims.user_id,
        },
        providerCheck.data,
      ),
    );
    if (!deleted) return { ok: false, error: 'not_found' };
    revalidateSettingsPaths();
    return { ok: true, message: 'key_deleted' };
  } catch (err) {
    const authState = authErrorToState(err);
    if (authState) return authState;
    console.error('[vault.delete] failed:', err);
    return { ok: false, error: 'internal_error' };
  }
}

export async function validateStoredKeyAction(
  provider: VaultProvider,
): Promise<VaultActionState> {
  const providerCheck = providerSchema.safeParse(provider);
  if (!providerCheck.success) return { ok: false, error: 'invalid_provider' };

  try {
    const vault = getKeyVaultService();
    const ctx = await getCurrentClerkContext();
    const actor = {
      orgId: ctx.claims.org_id!,
      actorClerkUserId: ctx.claims.user_id,
    };

    const plaintext = await withClerkRequest((tx) =>
      vault.getDecryptedKey(tx, actor, providerCheck.data),
    );
    if (!plaintext) return { ok: false, error: 'not_found' };

    const probe = await validateKey(providerCheck.data, plaintext);
    await withClerkRequest((tx) =>
      vault.markValidated(tx, actor, providerCheck.data, probe.valid, probe.reason),
    );

    revalidateSettingsPaths();
    if (!probe.valid) {
      return { ok: false, error: `validation_${probe.reason}` };
    }
    return { ok: true, message: 'key_validated' };
  } catch (err) {
    const authState = authErrorToState(err);
    if (authState) return authState;
    console.error('[vault.validate] failed:', err);
    return { ok: false, error: 'internal_error' };
  }
}
