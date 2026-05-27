import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().optional(),
  PORT: z.coerce.number().int().positive().optional(),
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  REDIS_URL: optionalUrl,
  /** Shared secret that gates the Bull Board UI + admin routes. When unset,
   * the admin surface is disabled (404) — safer default than open access. */
  ADMIN_API_TOKEN: z.preprocess(emptyToUndefined, z.string().min(16).optional()),
  /** Global rate-limit ceiling. Tune per route as we add public endpoints. */
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
  /** Base64-encoded 32-byte master key for AES-256-GCM in the BYOK vault.
   * Optional at boot so non-vault routes still work without it; the vault
   * service throws on first use when unset. Generate with
   * `openssl rand -base64 32`. NEVER commit; rotate via env redeploy. */
  KEY_VAULT_MASTER_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
});

const parsed = apiEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[api/env] invalid environment', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid API environment');
}

export const env = {
  ...parsed.data,
  API_PORT: parsed.data.API_PORT ?? parsed.data.PORT ?? 4000,
};
export type ApiEnv = typeof env;
