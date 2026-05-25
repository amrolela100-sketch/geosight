import 'dotenv/config';

import type { Config } from 'drizzle-kit';

// `db:generate` is offline (schema → SQL), so DATABASE_URL is optional here.
// `db:push` / `db:studio` need a live connection — they'll fail loudly if URL is empty.
// Migrations must run on the direct (non-pooled) connection.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '';

export default {
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: { url },
  strict: true,
  verbose: true,
} satisfies Config;
