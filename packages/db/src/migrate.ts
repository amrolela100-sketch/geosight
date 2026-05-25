/** Standalone migration runner — invoked via `pnpm db:migrate` from any
 * environment that has DATABASE_URL_UNPOOLED set.
 *
 * Migrations must use the direct (port 5432) connection because Supabase's
 * pgbouncer doesn't support all DDL statements over the transaction pooler.
 */

import 'dotenv/config';

import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { createDatabase } from './client.js';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL_UNPOOLED (or DATABASE_URL) is required. See .env.example.',
    );
  }

  const { db, sql } = createDatabase({ url, forMigration: true });
  try {
    console.info('[db:migrate] running migrations from ./migrations');
    await migrate(db, { migrationsFolder: './migrations' });
    console.info('[db:migrate] done');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[db:migrate] failed:', err);
  process.exit(1);
});
