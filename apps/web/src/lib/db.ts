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

  const url = env.DATABASE_URL ?? env.DATABASE_URL_UNPOOLED;
  if (!url) {
    throw new Error('DATABASE_URL is required for server-side DB access. See .env.example.');
  }

  // Next.js runtime paths do OLTP reads/writes, not migrations. Prefer the
  // pooled URL for local/dev/Vercel reliability, falling back to direct only
  // when no pooled URL is configured.
  cached = createDatabase({ url, max: 10 });
  return cached.db;
}
