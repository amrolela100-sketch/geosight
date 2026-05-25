import 'server-only';

import { z } from 'zod';

/** Runtime env schema for the Next.js server runtime.
 *
 * Public (NEXT_PUBLIC_*) vars are validated lazily by `clientEnv` so they
 * stay inlined into the browser bundle. Secrets are validated eagerly here.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_URL_UNPOOLED: z.string().min(1).optional(),

  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_WEBHOOK_SECRET: z.string().min(1).optional(),

  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().default('GeoSight <noreply@geosight.app>'),

  SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  // We log instead of throwing so `next build` succeeds in CI without secrets.
  // The runtime accesses below will throw the moment a missing key is needed.
  console.warn('[env] server env validation warnings:', parsed.error.flatten().fieldErrors);
}

export const env = parsed.success ? parsed.data : (serverEnvSchema.partial().parse(process.env) as z.infer<typeof serverEnvSchema>);

/** Public, browser-visible env. */
export const clientEnv = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '',
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
} as const;
