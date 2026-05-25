import 'dotenv/config';

import type { Config } from 'drizzle-kit';

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL (or DATABASE_URL_UNPOOLED) must be set for drizzle-kit. ' +
      'See .env.example at the repo root.',
  );
}

export default {
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: { url },
  strict: true,
  verbose: true,
  // Migrations must run on the direct (non-pooled) connection.
  // Application code uses the pooled URL.
} satisfies Config;
