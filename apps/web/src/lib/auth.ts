import 'server-only';

import { auth } from '@clerk/nextjs/server';

import {
  eq,
  users,
  withClerkAuth,
  type ClerkAuthContext,
  type DbTransaction,
} from '@geosight/db';

import { getServiceDb } from './db';

export class UnauthorizedError extends Error {
  readonly code = 'UNAUTHORIZED' as const;
  constructor() {
    super('No Clerk session on the current request.');
  }
}

export class NoActiveOrgError extends Error {
  readonly code = 'NO_ACTIVE_ORG' as const;
  constructor() {
    super(
      'Clerk session has no active organization. RLS denies multi-tenant rows in this state.',
    );
  }
}

export class UserNotProvisionedError extends Error {
  readonly code = 'USER_NOT_PROVISIONED' as const;
  constructor(clerkUserId: string) {
    super(
      `Clerk user ${clerkUserId} has no users row yet — webhook may not have fired.`,
    );
  }
}

/** Resolve the current Clerk session to a ClerkAuthContext carrying our
 * internal UUIDs (users.id, organizations.id). The Clerk session itself only
 * carries clerk_user_id / clerk_org_id — we lift them to internal UUIDs once
 * per request so RLS predicates stay single-column UUID comparisons.
 *
 * Throws when there's no session, no active org, or no users row yet (the
 * Clerk webhook hasn't provisioned the user). Callers convert these into the
 * appropriate HTTP / Server Action response.
 */
export async function getCurrentClerkContext(): Promise<ClerkAuthContext> {
  const session = await auth();
  if (!session.userId) throw new UnauthorizedError();

  const db = getServiceDb();
  const rows = await db
    .select({ id: users.id, orgId: users.orgId, role: users.role })
    .from(users)
    .where(eq(users.clerkUserId, session.userId))
    .limit(1);

  if (rows.length === 0) throw new UserNotProvisionedError(session.userId);

  const { id, orgId, role } = rows[0]!;
  if (!orgId) throw new NoActiveOrgError();

  return {
    claims: {
      user_id: id,
      org_id: orgId,
      org_role: role,
    },
  };
}

/** Run `fn` inside a DB transaction scoped to the current Clerk session.
 * `SET LOCAL ROLE authenticated` + `request.jwt.claims` are applied by
 * withClerkAuth, so every query inside `fn` is subject to RLS — the same way
 * a Supabase client request would be.
 *
 * Use this for every Server Action / route handler that reads or writes
 * tenant data. Service-only paths (webhooks, internal jobs) should use
 * getServiceDb() directly.
 */
export async function withClerkRequest<T>(
  fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  const ctx = await getCurrentClerkContext();
  return withClerkAuth(getServiceDb(), ctx, fn);
}
