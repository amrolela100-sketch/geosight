/** Integration test — proves that the RLS policies + withClerkAuth wiring
 * actually deny cross-tenant reads, writes, and forged-org_id inserts on the
 * brands table. Requires a live Postgres reachable via DATABASE_URL_UNPOOLED.
 *
 * Setup/teardown bypass RLS (service-role connection). Each `it` opens its
 * own Clerk-scoped transaction with `withClerkAuth`, which mirrors what a
 * real Server Action does for an authenticated request.
 */

import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  brands,
  createDatabase,
  eq,
  organizations,
  users,
  withClerkAuth,
} from '../src/index.js';
import type {
  ClerkAuthContext,
  Database,
  SqlClient,
} from '../src/index.js';

const runId = randomUUID().slice(0, 8);

let db: Database;
let sql: SqlClient;
let orgAId: string;
let orgBId: string;
let userAId: string;
let userBId: string;
let brandAId: string;
let brandBId: string;

beforeAll(async () => {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL_UNPOOLED (or DATABASE_URL) is required to run RLS tests.',
    );
  }

  const created = createDatabase({ url, forMigration: true });
  db = created.db;
  sql = created.sql;

  // Seed two orgs + two users + two brands using the service connection
  // (bypasses RLS because we haven't called SET LOCAL ROLE authenticated).
  const orgRows = await db
    .insert(organizations)
    .values([
      {
        clerkOrgId: `test_clerk_org_a_${runId}`,
        name: `Test Org A ${runId}`,
        slug: `test-org-a-${runId}`,
      },
      {
        clerkOrgId: `test_clerk_org_b_${runId}`,
        name: `Test Org B ${runId}`,
        slug: `test-org-b-${runId}`,
      },
    ])
    .returning({ id: organizations.id });
  orgAId = orgRows[0]!.id;
  orgBId = orgRows[1]!.id;

  const userRows = await db
    .insert(users)
    .values([
      {
        clerkUserId: `test_clerk_user_a_${runId}`,
        email: `user-a-${runId}@geosight.test`,
        orgId: orgAId,
        role: 'member',
      },
      {
        clerkUserId: `test_clerk_user_b_${runId}`,
        email: `user-b-${runId}@geosight.test`,
        orgId: orgBId,
        role: 'member',
      },
    ])
    .returning({ id: users.id });
  userAId = userRows[0]!.id;
  userBId = userRows[1]!.id;

  const brandRows = await db
    .insert(brands)
    .values([
      {
        orgId: orgAId,
        nameAr: `علامة أ ${runId}`,
        nameEn: `Brand A ${runId}`,
      },
      {
        orgId: orgBId,
        nameAr: `علامة ب ${runId}`,
        nameEn: `Brand B ${runId}`,
      },
    ])
    .returning({ id: brands.id });
  brandAId = brandRows[0]!.id;
  brandBId = brandRows[1]!.id;
});

afterAll(async () => {
  // ON DELETE CASCADE on organizations.id propagates to users + brands.
  if (orgAId) await db.delete(organizations).where(eq(organizations.id, orgAId));
  if (orgBId) await db.delete(organizations).where(eq(organizations.id, orgBId));
  if (sql) await sql.end({ timeout: 5 });
});

function ctxFor(
  userId: string,
  orgId: string | null,
  role: 'owner' | 'admin' | 'member' | 'viewer' | null = 'member',
): ClerkAuthContext {
  return { claims: { user_id: userId, org_id: orgId, org_role: role } };
}

describe('RLS isolation — brands', () => {
  it('User A sees only Brand A when listing brands', async () => {
    const rows = await withClerkAuth(db, ctxFor(userAId, orgAId), (tx) =>
      tx.select({ id: brands.id }).from(brands),
    );
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(brandAId);
    expect(ids).not.toContain(brandBId);
  });

  it('User B sees only Brand B when listing brands', async () => {
    const rows = await withClerkAuth(db, ctxFor(userBId, orgBId), (tx) =>
      tx.select({ id: brands.id }).from(brands),
    );
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(brandBId);
    expect(ids).not.toContain(brandAId);
  });

  it('User A cannot UPDATE Brand B — returns 0 rows', async () => {
    const updated = await withClerkAuth(db, ctxFor(userAId, orgAId), (tx) =>
      tx
        .update(brands)
        .set({ nameEn: 'HACKED' })
        .where(eq(brands.id, brandBId))
        .returning({ id: brands.id }),
    );
    expect(updated).toHaveLength(0);

    // Confirm Brand B was not mutated, via the service connection.
    const [check] = await db
      .select({ nameEn: brands.nameEn })
      .from(brands)
      .where(eq(brands.id, brandBId));
    expect(check?.nameEn).not.toBe('HACKED');
  });

  it('User A cannot DELETE Brand B — returns 0 rows', async () => {
    const deleted = await withClerkAuth(db, ctxFor(userAId, orgAId), (tx) =>
      tx
        .delete(brands)
        .where(eq(brands.id, brandBId))
        .returning({ id: brands.id }),
    );
    expect(deleted).toHaveLength(0);

    const [check] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.id, brandBId));
    expect(check?.id).toBe(brandBId);
  });

  it('User A cannot INSERT a brand with a forged org_id (Org B)', async () => {
    await expect(
      withClerkAuth(db, ctxFor(userAId, orgAId), (tx) =>
        tx.insert(brands).values({
          orgId: orgBId,
          nameAr: 'تجاوز',
          nameEn: 'Cross-tenant insert',
        }),
      ),
    ).rejects.toThrow(/row-level security|policy/i);
  });

  it('Viewer role cannot INSERT a brand even in its own org', async () => {
    await expect(
      withClerkAuth(db, ctxFor(userAId, orgAId, 'viewer'), (tx) =>
        tx.insert(brands).values({
          orgId: orgAId,
          nameAr: 'بدون صلاحية',
          nameEn: 'Viewer-no-write',
        }),
      ),
    ).rejects.toThrow(/row-level security|policy/i);
  });

  it('Session with org_id=null sees zero brands', async () => {
    const rows = await withClerkAuth(db, ctxFor(userAId, null), (tx) =>
      tx.select({ id: brands.id }).from(brands),
    );
    expect(rows).toHaveLength(0);
  });

  it('Missing user_id in claims throws before any query runs', async () => {
    await expect(
      withClerkAuth(db, { claims: { user_id: '', org_id: orgAId, org_role: 'member' } }, () =>
        Promise.resolve(null),
      ),
    ).rejects.toThrow(/withClerkAuth requires claims.user_id/);
  });
});
