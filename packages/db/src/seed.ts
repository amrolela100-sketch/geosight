/** Seed runner — populates the dev DB with three realistic Arabic-market
 * organizations + their team, brands, keywords, and ~200 historical scan
 * results.
 *
 * Idempotent: every row uses a `seed_` prefix on its Clerk ID / slug, and the
 * runner deletes those rows before inserting fresh ones (cascades through
 * users → brands → keywords → scan_results → daily_metrics via FK ON DELETE
 * CASCADE).
 *
 * Run via:  pnpm --filter @geosight/db db:seed
 *
 * Requires DATABASE_URL_UNPOOLED (or DATABASE_URL) in .env.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { like } from 'drizzle-orm';

import { createDatabase } from './client.js';
import {
  brands,
  dailyMetrics,
  keywords,
  organizations,
  scanResults,
  users,
} from './schema/index.js';
import {
  SEED_PREFIX,
  seedBrands,
  seedKeywords,
  seedOrgs,
  seedSnippets,
  seedUsers,
} from './seed/fixtures.js';
import { synthesizeHistory } from './seed/synth.js';

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../.env') });
config();

const SEED_SCAN_COUNT = 200;
const SEED_DAYS = 30;
const SEED_RNG = 20260526;

async function main(): Promise<void> {
  // Prefer the pooled URL (port 6543) for application-style writes; fall back
  // to the unpooled one. The seed is a regular OLTP workload, not DDL.
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!url) {
    throw new Error('DATABASE_URL (or DATABASE_URL_UNPOOLED) is required for seeding.');
  }

  const { db, sql } = createDatabase({ url, max: 4 });
  try {
    console.info(`[db:seed] clearing prior seed rows (clerk_org_id LIKE '${SEED_PREFIX}%')`);
    // Cascades into users/brands/keywords/scan_results/daily_metrics.
    await db.delete(organizations).where(like(organizations.clerkOrgId, `${SEED_PREFIX}%`));

    console.info('[db:seed] inserting organizations');
    const orgRows = await db
      .insert(organizations)
      .values(
        seedOrgs.map(({ handle: _handle, ...rest }) => rest),
      )
      .returning({ id: organizations.id, clerkOrgId: organizations.clerkOrgId });
    const orgIdByHandle = new Map<string, string>();
    for (const orgFix of seedOrgs) {
      const match = orgRows.find((r) => r.clerkOrgId === orgFix.clerkOrgId);
      if (!match) throw new Error(`Failed to insert org ${orgFix.handle}`);
      orgIdByHandle.set(orgFix.handle, match.id);
    }

    console.info('[db:seed] inserting users');
    await db.insert(users).values(
      seedUsers.map(({ orgHandle, ...rest }) => ({
        ...rest,
        orgId: orgIdByHandle.get(orgHandle)!,
      })),
    );

    console.info('[db:seed] inserting brands');
    const brandRows = await db
      .insert(brands)
      .values(
        seedBrands.map(({ handle: _handle, orgHandle, ...rest }) => ({
          ...rest,
          orgId: orgIdByHandle.get(orgHandle)!,
        })),
      )
      .returning({ id: brands.id, nameEn: brands.nameEn });
    const brandIdByHandle = new Map<string, string>();
    for (const brandFix of seedBrands) {
      const match = brandRows.find((r) => r.nameEn === brandFix.nameEn);
      if (!match) throw new Error(`Failed to insert brand ${brandFix.handle}`);
      brandIdByHandle.set(brandFix.handle, match.id);
    }

    console.info('[db:seed] inserting keywords');
    const keywordRows = await db
      .insert(keywords)
      .values(
        seedKeywords.map(({ brandHandle, ...rest }) => ({
          ...rest,
          brandId: brandIdByHandle.get(brandHandle)!,
        })),
      )
      .returning({ id: keywords.id, brandId: keywords.brandId, dialect: keywords.dialect });

    console.info(`[db:seed] synthesizing ${SEED_SCAN_COUNT} scans over ${SEED_DAYS} days`);
    const synthesized = synthesizeHistory({
      seed: SEED_RNG,
      totalScans: SEED_SCAN_COUNT,
      days: SEED_DAYS,
      brands: seedBrands.map((b) => ({
        handle: b.handle,
        brandId: brandIdByHandle.get(b.handle)!,
        competitors: b.competitors as readonly string[],
        keywords: keywordRows
          .filter((k) => k.brandId === brandIdByHandle.get(b.handle))
          .map((k) => ({ id: k.id, dialect: k.dialect })),
      })),
      snippets: (handle, provider, sentiment) =>
        seedSnippets[handle]![provider]![sentiment],
    });

    console.info(`[db:seed] inserting ${synthesized.scans.length} scan_results`);
    // Postgres has a parameter limit; insert in chunks of 50.
    for (let i = 0; i < synthesized.scans.length; i += 50) {
      await db.insert(scanResults).values(synthesized.scans.slice(i, i + 50));
    }

    console.info(`[db:seed] inserting ${synthesized.dailyMetrics.length} daily_metrics`);
    for (let i = 0; i < synthesized.dailyMetrics.length; i += 50) {
      await db.insert(dailyMetrics).values(synthesized.dailyMetrics.slice(i, i + 50));
    }

    console.info('[db:seed] done — summary:');
    console.info(`  organizations: ${orgRows.length}`);
    console.info(`  users:         ${seedUsers.length}`);
    console.info(`  brands:        ${brandRows.length}`);
    console.info(`  keywords:      ${keywordRows.length}`);
    console.info(`  scan_results:  ${synthesized.scans.length}`);
    console.info(`  daily_metrics: ${synthesized.dailyMetrics.length}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[db:seed] failed:', err);
  process.exit(1);
});
