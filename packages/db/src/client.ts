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
// Each authenticated request opens a transaction that SETs LOCAL ROLE to
// `authenticated` (so `TO authenticated` policies match) and SETs
// request.jwt.claims to a JSON-encoded claim set. The RLS helpers
// (geosight_current_org_id / geosight_current_role) parse it via
// current_setting('request.jwt.claims', true)::json.
//
// The claim shape mirrors the Supabase JWT template documented in
// project-clerk-supabase-rls memory — but user_id / org_id carry the INTERNAL
// UUIDs from users.id / organizations.id, NOT the raw Clerk IDs. The caller
// (Fastify / Next middleware) resolves clerk_user_id → users.id once per
// request so RLS predicates stay single-column UUID comparisons instead of
// joining through clerk_org_id on every check.
// ─────────────────────────────────────────────────────────────────────────────

export interface ClerkClaims {
  /** Internal users.id (UUID), resolved from clerk_user_id by the caller. */
  readonly user_id: string;
  /** Internal organizations.id (UUID). Null when the session has no active
   * org — RLS denies multi-tenant rows in that state. */
  readonly org_id: string | null;
  /** Normalised role: 'owner' | 'admin' | 'member' | 'viewer'. */
  readonly org_role: string | null;
}

export interface ClerkAuthContext {
  readonly claims: ClerkClaims;
}

/** Run `fn` inside a transaction scoped to the Clerk-issued claims so RLS
 * applies. Throws if claims.user_id is empty — silent denial would be worse. */
export async function withClerkAuth<T>(
  db: Database,
  ctx: ClerkAuthContext,
  fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  if (!ctx.claims?.user_id) {
    throw new Error(
      'withClerkAuth requires claims.user_id (internal users.id UUID resolved from clerk_user_id).',
    );
  }

  const claimsJson = JSON.stringify({
    aud: 'authenticated',
    role: 'authenticated',
    user_id: ctx.claims.user_id,
    org_id: ctx.claims.org_id,
    org_role: ctx.claims.org_role,
  });

  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE authenticated`);
    await tx.execute(sql`SELECT set_config('request.jwt.claims', ${claimsJson}, true)`);
    return fn(tx);
  });
}
