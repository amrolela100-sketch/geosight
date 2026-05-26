/** Integration test for RLS on keywords. Keywords are tenant-scoped via
 * their brand_id FK rather than carrying org_id directly — the policy reads
 * `brand_id IN (SELECT id FROM brands WHERE org_id = current_org_id())`,
 * so a leak here would also imply a brands-table leak. Hence we test it
 * explicitly: the FK chain is what we're actually proving.
 */

import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  brands,
  createDatabase,
  eq,
  keywords,
  organizations,
  users,
  withClerkAuth,
} from '../src/index.js';
import type { ClerkAuthContext, Database, SqlClient } from '../src/index.js';

const runId = randomUUID().slice(0, 8);

let db: Database;
let sql: SqlClient;
let orgAId: string;
let orgBId: string;
let userAId: string;
let userBId: string;
let brandAId: string;
let brandBId: string;
let keywordAId: string;
let keywordBId: string;

beforeAll(async () => {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!url) {
    throw new Error('DATABASE_URL (or DATABASE_URL_UNPOOLED) is required to run RLS tests.');
  }

  const created = createDatabase({ url, forMigration: true });
  db = created.db;
  sql = created.sql;

  const orgRows = await db
    .insert(organizations)
    .values([
      {
        clerkOrgId: `test_clerk_org_kw_a_${runId}`,
        name: `Test KW Org A ${runId}`,
        slug: `test-kw-org-a-${runId}`,
      },
      {
        clerkOrgId: `test_clerk_org_kw_b_${runId}`,
        name: `Test KW Org B ${runId}`,
        slug: `test-kw-org-b-${runId}`,
      },
    ])
    .returning({ id: organizations.id });
  orgAId = orgRows[0]!.id;
  orgBId = orgRows[1]!.id;

  const userRows = await db
    .insert(users)
    .values([
      {
        clerkUserId: `test_clerk_user_kw_a_${runId}`,
        email: `user-kw-a-${runId}@geosight.test`,
        orgId: orgAId,
        role: 'member',
      },
      {
        clerkUserId: `test_clerk_user_kw_b_${runId}`,
        email: `user-kw-b-${runId}@geosight.test`,
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
      { orgId: orgAId, nameAr: `علامة كلمات أ ${runId}`, nameEn: `KW Brand A ${runId}` },
      { orgId: orgBId, nameAr: `علامة كلمات ب ${runId}`, nameEn: `KW Brand B ${runId}` },
    ])
    .returning({ id: brands.id });
  brandAId = brandRows[0]!.id;
  brandBId = brandRows[1]!.id;

  const keywordRows = await db
    .insert(keywords)
    .values([
      {
        brandId: brandAId,
        queryText: `سؤال أ ${runId}`,
        language: 'ar',
        dialect: 'msa',
      },
      {
        brandId: brandBId,
        queryText: `سؤال ب ${runId}`,
        language: 'ar',
        dialect: 'gulf',
      },
    ])
    .returning({ id: keywords.id });
  keywordAId = keywordRows[0]!.id;
  keywordBId = keywordRows[1]!.id;
});

afterAll(async () => {
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

describe('RLS isolation — keywords (FK chain through brands.org_id)', () => {
  it('User A sees only Keyword A', async () => {
    const rows = await withClerkAuth(db, ctxFor(userAId, orgAId), (tx) =>
      tx.select({ id: keywords.id }).from(keywords),
    );
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(keywordAId);
    expect(ids).not.toContain(keywordBId);
  });

  it('User B sees only Keyword B', async () => {
    const rows = await withClerkAuth(db, ctxFor(userBId, orgBId), (tx) =>
      tx.select({ id: keywords.id }).from(keywords),
    );
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(keywordBId);
    expect(ids).not.toContain(keywordAId);
  });

  it('User A cannot UPDATE Keyword B — returns 0 rows', async () => {
    const updated = await withClerkAuth(db, ctxFor(userAId, orgAId), (tx) =>
      tx
        .update(keywords)
        .set({ queryText: 'HACKED' })
        .where(eq(keywords.id, keywordBId))
        .returning({ id: keywords.id }),
    );
    expect(updated).toHaveLength(0);

    const [check] = await db
      .select({ queryText: keywords.queryText })
      .from(keywords)
      .where(eq(keywords.id, keywordBId));
    expect(check?.queryText).not.toBe('HACKED');
  });

  it('User A cannot DELETE Keyword B — returns 0 rows', async () => {
    const deleted = await withClerkAuth(db, ctxFor(userAId, orgAId), (tx) =>
      tx.delete(keywords).where(eq(keywords.id, keywordBId)).returning({ id: keywords.id }),
    );
    expect(deleted).toHaveLength(0);
  });

  it("User A cannot INSERT a keyword pointing at Org B's brand", async () => {
    await expect(
      withClerkAuth(db, ctxFor(userAId, orgAId), (tx) =>
        tx.insert(keywords).values({
          brandId: brandBId,
          queryText: 'cross-tenant insert',
          language: 'ar',
          dialect: 'auto',
        }),
      ),
    ).rejects.toThrow(/row-level security|policy/i);
  });

  it('Viewer role cannot INSERT a keyword even on own org brand', async () => {
    await expect(
      withClerkAuth(db, ctxFor(userAId, orgAId, 'viewer'), (tx) =>
        tx.insert(keywords).values({
          brandId: brandAId,
          queryText: 'viewer write attempt',
          language: 'ar',
          dialect: 'auto',
        }),
      ),
    ).rejects.toThrow(/row-level security|policy/i);
  });

  it('Session with org_id=null sees zero keywords', async () => {
    const rows = await withClerkAuth(db, ctxFor(userAId, null), (tx) =>
      tx.select({ id: keywords.id }).from(keywords),
    );
    expect(rows).toHaveLength(0);
  });
});
