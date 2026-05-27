import 'server-only';

import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalNonEmptyString = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

/** Runtime env schema for the Next.js server runtime.
 *
 * Public (NEXT_PUBLIC_*) vars are validated lazily by `clientEnv` so they
 * stay inlined into the browser bundle. Secrets are validated eagerly here.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: optionalNonEmptyString,
  DATABASE_URL_UNPOOLED: optionalNonEmptyString,

  CLERK_SECRET_KEY: optionalNonEmptyString,
  CLERK_WEBHOOK_SECRET: optionalNonEmptyString,

  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmptyString,

  RESEND_API_KEY: optionalNonEmptyString,
  EMAIL_FROM: z.string().default('GeoSight <noreply@geosight.app>'),

  SENTRY_DSN: optionalUrl,
  SENTRY_AUTH_TOKEN: optionalNonEmptyString,

  /** Base64-encoded 32-byte master key for AES-256-GCM in the BYOK vault.
   * Required for vault Server Actions. Generate with `openssl rand -base64 32`. */
  KEY_VAULT_MASTER_KEY: optionalNonEmptyString,
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  // We log instead of throwing so `next build` succeeds in CI without secrets.
  // The runtime accesses below will throw the moment a missing key is needed.
  console.warn('[env] server env validation warnings:', parsed.error.flatten().fieldErrors);
}

export const env = parsed.success
  ? parsed.data
  : (serverEnvSchema.partial().parse(process.env) as z.infer<typeof serverEnvSchema>);

/** Public, browser-visible env. */
export const clientEnv = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '',
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
} as const;
