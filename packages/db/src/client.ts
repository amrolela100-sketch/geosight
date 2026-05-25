import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

export type Database = ReturnType<typeof drizzle<typeof schema>>;
export type SqlClient = ReturnType<typeof postgres>;
export type DbTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface ClientOptions {
  /** Pooled connection string (port 6543 on Supabase). */
  readonly url: string;
  /** Set to `true` for the migration runner; uses the unpooled connection. */
  readonly forMigration?: boolean;
  /** Cap connection-pool size — defaults to 1 for serverless edge runtimes. */
  readonly max?: number;
}

/** Build a postgres-js client tuned for the runtime.
 *
 * For Next.js Edge / Vercel Functions: pass `max: 1` and use the pooled URL.
 * For long-lived processes (Fastify api / BullMQ workers): pass higher `max`.
 */
export function createSqlClient({ url, forMigration = false, max = 1 }: ClientOptions): SqlClient {
  return postgres(url, {
    max: forMigration ? 1 : max,
    prepare: !forMigration,
    idle_timeout: forMigration ? 30 : 10,
    connect_timeout: 30,
  });
}

/** Build a Drizzle instance wrapping `sql`. */
export function createDb(sqlClient: SqlClient): Database {
  return drizzle(sqlClient, { schema });
}

/** End-to-end factory: create a DB ready for app use. */
export function createDatabase(opts: ClientOptions): { db: Database; sql: SqlClient } {
  const sqlClient = createSqlClient(opts);
  const db = createDb(sqlClient);
  return { db, sql: sqlClient };
}

// ─────────────────────────────────────────────────────────────────────────────
// Clerk-aware request scope.
//
// Every authenticated request opens a transaction, SETs the JWT claims as a
// Postgres session variable, and runs the user's queries inside it. The RLS
// policies read those claims via current_setting('request.jwt.claims').
//
// The shape mirrors the Supabase JWT template documented in
// project-clerk-supabase-rls memory.
// ─────────────────────────────────────────────────────────────────────────────

export interface ClerkAuthContext {
  /** The Clerk-issued JWT (signed against Supabase's JWT_SECRET). */
  readonly token: string;
}

/** Wrap `fn` in a transaction that establishes Clerk JWT context for RLS.
 *
 * Throws if the token is empty — RLS policies will then deny every query.
 */
export async function withClerkAuth<T>(
  db: Database,
  ctx: ClerkAuthContext,
  fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  if (!ctx.token) {
    throw new Error(
      'withClerkAuth requires a non-empty token. Calling without one would bypass RLS.',
    );
  }

  return db.transaction(async (tx) => {
    // The setting persists for the lifetime of this transaction only.
    // `set_config(name, value, is_local)` with is_local=true scopes to TX.
    await tx.execute(sql`SELECT set_config('request.jwt.claims', ${ctx.token}, true)`);
    return fn(tx);
  });
}
