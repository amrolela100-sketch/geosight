import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),
  REDIS_URL: optionalUrl,
});

const parsed = apiEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[api/env] invalid environment', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid API environment');
}

export const env = parsed.data;
export type ApiEnv = typeof env;
