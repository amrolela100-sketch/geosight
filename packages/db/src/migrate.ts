/** Standalone migration runner — invoked via `pnpm db:migrate` from any
 * environment that has DATABASE_URL_UNPOOLED set.
 *
 * Migrations must use the direct (port 5432) connection because Supabase's
 * pgbouncer doesn't support all DDL statements over the transaction pooler.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { createDatabase } from './client.js';

// Load .env from the monorepo root (two levels above packages/db/src),
// falling back to CWD if the file isn't there.
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../.env') });
config();

// drizzle-kit doesn't generate RLS policies — we apply rls-policies.sql as a
// post-step. It's idempotent (DROP POLICY IF EXISTS + CREATE OR REPLACE).
const RLS_FILE = resolve(here, '../migrations/rls-policies.sql');

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL_UNPOOLED (or DATABASE_URL) is required. See .env.example.');
  }

  const { db, sql } = createDatabase({ url, forMigration: true });
  try {
    console.info('[db:migrate] running drizzle migrations from ./migrations');
    await migrate(db, { migrationsFolder: './migrations' });

    console.info('[db:migrate] applying RLS policies from rls-policies.sql');
    const rlsSql = await readFile(RLS_FILE, 'utf8');
    await sql.unsafe(rlsSql);

    console.info('[db:migrate] done');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[db:migrate] failed:', err);
  process.exit(1);
});
