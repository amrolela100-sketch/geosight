import 'server-only';

import {
  and,
  brands,
  dailyMetrics,
  gte,
  keywords,
  lt,
  scanResults,
  sql,
} from '@geosight/db';

import {
  NoActiveOrgError,
  UnauthorizedError,
  UserNotProvisionedError,
  withClerkRequest,
} from '@/lib/auth';

export type OverviewSummary = {
  brandsCount: number;
  keywordsCount: number;
  activeKeywordsCount: number;
  totalScans: number;
  brandMentions: number;
  avgGeoScore: number;
  aiShareOfVoice: number;
  geoScoreDelta: number | null;
  sovDelta: number | null;
};

export type GeoScoreTrendPoint = {
  date: string;
  avgGeoScore: number;
  totalScans: number;
};

export type ProviderShare = {
  provider: string;
  scans: number;
  mentions: number;
  avgGeoScore: number;
};

const DAY_MS = 86_400_000;

const empty: OverviewSummary = {
  brandsCount: 0,
  keywordsCount: 0,
  activeKeywordsCount: 0,
  totalScans: 0,
  brandMentions: 0,
  avgGeoScore: 0,
  aiShareOfVoice: 0,
  geoScoreDelta: null,
  sovDelta: null,
};

function isAuthError(err: unknown): boolean {
  return (
    err instanceof UnauthorizedError ||
    err instanceof NoActiveOrgError ||
    err instanceof UserNotProvisionedError
  );
}

function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / prev) * 100;
}

function sovOf(mentions: number, competitors: number): number {
  const denom = mentions + competitors;
  return denom === 0 ? 0 : (mentions / denom) * 100;
}

export async function getOverviewSummary(): Promise<OverviewSummary> {
  try {
    return await withClerkRequest(async (tx) => {
      const now = new Date();
      const w0 = new Date(now.getTime() - 14 * DAY_MS);
      const w1 = new Date(now.getTime() - 28 * DAY_MS);

      const [brandRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(brands);
      const [keywordRow] = await tx
        .select({
          count: sql<number>`count(*)::int`,
          active: sql<number>`count(*) filter (where ${keywords.isActive})::int`,
        })
        .from(keywords);

      const aggSelect = {
        totalScans: sql<number>`count(*)::int`,
        mentions: sql<number>`count(*) filter (where ${scanResults.brandMentioned})::int`,
        competitors: sql<number>`coalesce(sum(coalesce(array_length(${scanResults.competitorsMentioned}, 1), 0)), 0)::int`,
        avgScore: sql<number>`coalesce(avg(${scanResults.geoScore}), 0)::float`,
      };

      const [cur] = await tx
        .select(aggSelect)
        .from(scanResults)
        .innerJoin(keywords, sql`${scanResults.keywordId} = ${keywords.id}`)
        .where(gte(scanResults.scannedAt, w0));
      const [prev] = await tx
        .select(aggSelect)
        .from(scanResults)
        .innerJoin(keywords, sql`${scanResults.keywordId} = ${keywords.id}`)
        .where(and(gte(scanResults.scannedAt, w1), lt(scanResults.scannedAt, w0)));

      const c = cur ?? { totalScans: 0, mentions: 0, competitors: 0, avgScore: 0 };
      const p = prev ?? { totalScans: 0, mentions: 0, competitors: 0, avgScore: 0 };
      const sovCur = sovOf(c.mentions, c.competitors);
      const sovPrev = sovOf(p.mentions, p.competitors);

      return {
        brandsCount: brandRow?.count ?? 0,
        keywordsCount: keywordRow?.count ?? 0,
        activeKeywordsCount: keywordRow?.active ?? 0,
        totalScans: c.totalScans,
        brandMentions: c.mentions,
        avgGeoScore: c.avgScore,
        aiShareOfVoice: sovCur,
        geoScoreDelta: pctDelta(c.avgScore, p.avgScore),
        sovDelta: pctDelta(sovCur, sovPrev),
      };
    });
  } catch (err) {
    if (isAuthError(err)) return empty;
    throw err;
  }
}

export async function getGeoScoreTrend(days = 14): Promise<GeoScoreTrendPoint[]> {
  try {
    return await withClerkRequest(async (tx) => {
      const since = new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);
      const rows = await tx
        .select({
          date: dailyMetrics.metricDate,
          avgGeoScore: sql<number>`avg(${dailyMetrics.avgGeoScore})::float`,
          totalScans: sql<number>`coalesce(sum(${dailyMetrics.totalScans}), 0)::int`,
        })
        .from(dailyMetrics)
        .where(sql`${dailyMetrics.metricDate} >= ${since}`)
        .groupBy(dailyMetrics.metricDate)
        .orderBy(dailyMetrics.metricDate);
      return rows.map((r) => ({
        date: r.date,
        avgGeoScore: Number(r.avgGeoScore ?? 0),
        totalScans: Number(r.totalScans ?? 0),
      }));
    });
  } catch (err) {
    if (isAuthError(err)) return [];
    throw err;
  }
}

export async function getProviderBreakdown(): Promise<ProviderShare[]> {
  try {
    return await withClerkRequest(async (tx) => {
      const w0 = new Date(Date.now() - 14 * DAY_MS);
      const rows = await tx
        .select({
          provider: scanResults.aiProvider,
          scans: sql<number>`count(*)::int`,
          mentions: sql<number>`count(*) filter (where ${scanResults.brandMentioned})::int`,
          avgScore: sql<number>`coalesce(avg(${scanResults.geoScore}), 0)::float`,
        })
        .from(scanResults)
        .innerJoin(keywords, sql`${scanResults.keywordId} = ${keywords.id}`)
        .where(gte(scanResults.scannedAt, w0))
        .groupBy(scanResults.aiProvider)
        .orderBy(scanResults.aiProvider);
      return rows.map((r) => ({
        provider: r.provider,
        scans: Number(r.scans ?? 0),
        mentions: Number(r.mentions ?? 0),
        avgGeoScore: Number(r.avgScore ?? 0),
      }));
    });
  } catch (err) {
    if (isAuthError(err)) return [];
    throw err;
  }
}
