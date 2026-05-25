import 'server-only';

import { createDatabase, type Database, type SqlClient } from '@geosight/db';

import { env } from './env';

let cached: { db: Database; sql: SqlClient } | null = null;

/** Service-role DB client. Bypasses RLS — only use from server-only code paths
 * that have already verified the caller (Clerk webhooks via svix, internal
 * jobs). For per-request user queries, use a Clerk-aware client with
 * `withClerkAuth` instead.
 */
export function getServiceDb(): Database {
  if (cached) return cached.db;

  const url = env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is required for server-side DB access. See .env.example.',
    );
  }

  // Long-lived process (Next.js server) — allow a larger pool than the edge
  // default. Unpooled URL because RLS-bypassing service paths may run DDL-ish
  // operations that pgbouncer can't proxy.
  cached = createDatabase({ url, max: 10 });
  return cached.db;
}
