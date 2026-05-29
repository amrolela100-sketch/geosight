import 'server-only';

import {
  and,
  asc,
  brands,
  dailyMetrics,
  desc,
  eq,
  gte,
  keywords,
  lt,
  scanResults,
  sql,
} from '@geosight/db';
import { uuidSchema } from '@geosight/shared';

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

export type KeywordOpsSummary = {
  totalKeywords: number;
  activeKeywords: number;
  pausedKeywords: number;
  neverScanned: number;
  avgGeoScore: number;
  brandMentions: number;
  totalScans: number;
};

export type KeywordPerformance = {
  id: string;
  queryText: string;
  brandNameAr: string;
  brandNameEn: string;
  language: string;
  dialect: string;
  schedule: string;
  isActive: boolean;
  lastScannedAt: Date | null;
  scanCount: number;
  avgGeoScore: number;
  brandMentions: number;
  competitorMentions: number;
  latestScanId: string | null;
  latestProvider: string | null;
  latestGeoScore: number | null;
};

export type LatestScanItem = {
  id: string;
  keywordId: string;
  queryText: string;
  brandNameAr: string;
  brandNameEn: string;
  provider: string;
  geoScore: number;
  brandMentioned: boolean;
  sentiment: string;
  citationsCount: number;
  competitorsCount: number;
  scannedAt: Date;
};

export type CompetitorInsight = {
  name: string;
  mentions: number;
  aiShareOfVoice: number;
  avgGeoScore: number;
  brands: string[];
  providers: string[];
  lastSeenAt: Date | null;
};

export type ScanDetail = {
  id: string;
  keywordId: string;
  queryText: string;
  brandNameAr: string;
  brandNameEn: string;
  provider: string;
  geoScore: number;
  brandMentioned: boolean;
  mentionPosition: number | null;
  mentionRank: number | null;
  sentiment: string;
  sentimentScore: number;
  citations: string[];
  competitorsMentioned: string[];
  contextSnippet: string | null;
  detectedDialect: string | null;
  latencyMs: number;
  scannedAt: Date;
  rawResponse: Record<string, unknown>;
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

const emptyKeywordOps: KeywordOpsSummary = {
  totalKeywords: 0,
  activeKeywords: 0,
  pausedKeywords: 0,
  neverScanned: 0,
  avgGeoScore: 0,
  brandMentions: 0,
  totalScans: 0,
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

export async function getKeywordOpsSummary(): Promise<KeywordOpsSummary> {
  try {
    return await withClerkRequest(async (tx) => {
      const [row] = await tx
        .select({
          totalKeywords: sql<number>`count(distinct ${keywords.id})::int`,
          activeKeywords: sql<number>`count(distinct ${keywords.id}) filter (where ${keywords.isActive})::int`,
          pausedKeywords: sql<number>`count(distinct ${keywords.id}) filter (where not ${keywords.isActive})::int`,
          neverScanned: sql<number>`count(distinct ${keywords.id}) filter (where ${keywords.lastScannedAt} is null)::int`,
          totalScans: sql<number>`count(${scanResults.id})::int`,
          brandMentions: sql<number>`count(${scanResults.id}) filter (where ${scanResults.brandMentioned})::int`,
          avgGeoScore: sql<number>`coalesce(avg(${scanResults.geoScore}), 0)::float`,
        })
        .from(keywords)
        .innerJoin(brands, eq(brands.id, keywords.brandId))
        .leftJoin(scanResults, eq(scanResults.keywordId, keywords.id));

      return {
        totalKeywords: Number(row?.totalKeywords ?? 0),
        activeKeywords: Number(row?.activeKeywords ?? 0),
        pausedKeywords: Number(row?.pausedKeywords ?? 0),
        neverScanned: Number(row?.neverScanned ?? 0),
        totalScans: Number(row?.totalScans ?? 0),
        brandMentions: Number(row?.brandMentions ?? 0),
        avgGeoScore: Number(row?.avgGeoScore ?? 0),
      };
    });
  } catch (err) {
    if (isAuthError(err)) return emptyKeywordOps;
    throw err;
  }
}

export async function getKeywordPerformance(brandId?: string): Promise<KeywordPerformance[]> {
  const brandFilter = brandId ? uuidSchema.safeParse(brandId) : null;
  const filter = brandFilter?.success ? eq(keywords.brandId, brandFilter.data) : undefined;
  try {
    return await withClerkRequest(async (tx) => {
      const latestScan = tx
        .select({
          id: scanResults.id,
          keywordId: scanResults.keywordId,
          aiProvider: scanResults.aiProvider,
          geoScore: scanResults.geoScore,
          scannedAt: scanResults.scannedAt,
          rowNumber: sql<number>`row_number() over (partition by ${scanResults.keywordId} order by ${scanResults.scannedAt} desc)`.as(
            'row_number',
          ),
        })
        .from(scanResults)
        .as('latest_scan');

      const rows = await tx
        .select({
          id: keywords.id,
          queryText: keywords.queryText,
          brandNameAr: brands.nameAr,
          brandNameEn: brands.nameEn,
          language: keywords.language,
          dialect: keywords.dialect,
          schedule: keywords.schedule,
          isActive: keywords.isActive,
          lastScannedAt: keywords.lastScannedAt,
          scanCount: sql<number>`count(${scanResults.id})::int`,
          avgGeoScore: sql<number>`coalesce(avg(${scanResults.geoScore}), 0)::float`,
          brandMentions: sql<number>`count(${scanResults.id}) filter (where ${scanResults.brandMentioned})::int`,
          competitorMentions: sql<number>`coalesce(sum(coalesce(array_length(${scanResults.competitorsMentioned}, 1), 0)), 0)::int`,
          latestScanId: latestScan.id,
          latestProvider: latestScan.aiProvider,
          latestGeoScore: latestScan.geoScore,
        })
        .from(keywords)
        .innerJoin(brands, eq(brands.id, keywords.brandId))
        .leftJoin(scanResults, eq(scanResults.keywordId, keywords.id))
        .leftJoin(
          latestScan,
          and(eq(latestScan.keywordId, keywords.id), sql`${latestScan.rowNumber} = 1`),
        )
        .where(filter)
        .groupBy(
          keywords.id,
          brands.nameAr,
          brands.nameEn,
          latestScan.id,
          latestScan.aiProvider,
          latestScan.geoScore,
          latestScan.scannedAt,
        )
        .orderBy(desc(keywords.createdAt));

      return rows.map((row) => ({
        id: row.id,
        queryText: row.queryText,
        brandNameAr: row.brandNameAr,
        brandNameEn: row.brandNameEn,
        language: row.language,
        dialect: row.dialect,
        schedule: row.schedule,
        isActive: row.isActive,
        lastScannedAt: row.lastScannedAt,
        scanCount: Number(row.scanCount ?? 0),
        avgGeoScore: Number(row.avgGeoScore ?? 0),
        brandMentions: Number(row.brandMentions ?? 0),
        competitorMentions: Number(row.competitorMentions ?? 0),
        latestScanId: row.latestScanId ?? null,
        latestProvider: row.latestProvider ?? null,
        latestGeoScore: row.latestGeoScore === null ? null : Number(row.latestGeoScore),
      }));
    });
  } catch (err) {
    if (isAuthError(err)) return [];
    throw err;
  }
}

export async function getLatestScans(limit = 8): Promise<LatestScanItem[]> {
  try {
    return await withClerkRequest(async (tx) => {
      const rows = await tx
        .select({
          id: scanResults.id,
          keywordId: scanResults.keywordId,
          queryText: keywords.queryText,
          brandNameAr: brands.nameAr,
          brandNameEn: brands.nameEn,
          provider: scanResults.aiProvider,
          geoScore: scanResults.geoScore,
          brandMentioned: scanResults.brandMentioned,
          sentiment: scanResults.sentiment,
          citationsCount: sql<number>`coalesce(array_length(${scanResults.citations}, 1), 0)::int`,
          competitorsCount: sql<number>`coalesce(array_length(${scanResults.competitorsMentioned}, 1), 0)::int`,
          scannedAt: scanResults.scannedAt,
        })
        .from(scanResults)
        .innerJoin(keywords, eq(scanResults.keywordId, keywords.id))
        .innerJoin(brands, eq(keywords.brandId, brands.id))
        .orderBy(desc(scanResults.scannedAt))
        .limit(limit);

      return rows.map((row) => ({
        ...row,
        geoScore: Number(row.geoScore),
        citationsCount: Number(row.citationsCount ?? 0),
        competitorsCount: Number(row.competitorsCount ?? 0),
      }));
    });
  } catch (err) {
    if (isAuthError(err)) return [];
    throw err;
  }
}

export async function getCompetitorInsights(): Promise<CompetitorInsight[]> {
  try {
    return await withClerkRequest(async (tx) => {
      const rows = await tx.execute<{
        name: string;
        mentions: number;
        aiShareOfVoice: number;
        avgGeoScore: number;
        brands: string[];
        providers: string[];
        lastSeenAt: Date | null;
      }>(sql`
        select
          competitor.item->>'competitor' as "name",
          coalesce(sum((competitor.item->>'mentions')::int), 0)::int as "mentions",
          coalesce(sum((competitor.item->>'aiSoV')::float), 0)::float as "aiShareOfVoice",
          coalesce(avg(${dailyMetrics.avgGeoScore}), 0)::float as "avgGeoScore",
          array_remove(array_agg(distinct ${brands.nameEn}), null) as "brands",
          array_remove(
            array_agg(distinct provider.item->>'provider') filter (where provider.item is not null),
            null
          ) as "providers",
          max(${dailyMetrics.metricDate})::timestamp as "lastSeenAt"
        from ${dailyMetrics}
        inner join ${brands} on ${brands.id} = ${dailyMetrics.brandId}
        cross join lateral jsonb_array_elements(${dailyMetrics.competitorBreakdown}) as competitor(item)
        left join lateral jsonb_array_elements(${dailyMetrics.providerBreakdown}) as provider(item) on true
        group by competitor.item->>'competitor'
        order by "mentions" desc
        limit 25
      `);

      return rows.map((row) => {
        const mentions = Number(row.mentions ?? 0);
        return {
          name: row.name,
          mentions,
          aiShareOfVoice: Number(row.aiShareOfVoice ?? 0),
          avgGeoScore: Number(row.avgGeoScore ?? 0),
          brands: row.brands ?? [],
          providers: row.providers ?? [],
          lastSeenAt: row.lastSeenAt ?? null,
        };
      });
    });
  } catch (err) {
    if (isAuthError(err)) return [];
    throw err;
  }
}

export async function getCompetitorTrend(days = 14): Promise<Array<{ date: string; mentions: number }>> {
  try {
    return await withClerkRequest(async (tx) => {
      const since = new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);
      const rows = await tx
        .select({
          date: dailyMetrics.metricDate,
          mentions: sql<number>`coalesce(sum(coalesce((competitor.item->>'mentions')::int, 0)), 0)::int`,
        })
        .from(dailyMetrics)
        .innerJoin(brands, eq(brands.id, dailyMetrics.brandId))
        .leftJoin(
          sql`jsonb_array_elements(${dailyMetrics.competitorBreakdown}) as competitor(item)`,
          sql`true`,
        )
        .where(sql`${dailyMetrics.metricDate} >= ${since}`)
        .groupBy(dailyMetrics.metricDate)
        .orderBy(asc(dailyMetrics.metricDate));

      return rows.map((row) => ({
        date: row.date,
        mentions: Number(row.mentions ?? 0),
      }));
    });
  } catch (err) {
    if (isAuthError(err)) return [];
    throw err;
  }
}

export async function getScanDetail(scanId: string): Promise<ScanDetail | null> {
  const idCheck = uuidSchema.safeParse(scanId);
  if (!idCheck.success) return null;

  try {
    return await withClerkRequest(async (tx) => {
      const [row] = await tx
        .select({
          id: scanResults.id,
          keywordId: scanResults.keywordId,
          queryText: keywords.queryText,
          brandNameAr: brands.nameAr,
          brandNameEn: brands.nameEn,
          provider: scanResults.aiProvider,
          geoScore: scanResults.geoScore,
          brandMentioned: scanResults.brandMentioned,
          mentionPosition: scanResults.mentionPosition,
          mentionRank: scanResults.mentionRank,
          sentiment: scanResults.sentiment,
          sentimentScore: scanResults.sentimentScore,
          citations: scanResults.citations,
          competitorsMentioned: scanResults.competitorsMentioned,
          contextSnippet: scanResults.contextSnippet,
          detectedDialect: scanResults.detectedDialect,
          latencyMs: scanResults.latencyMs,
          scannedAt: scanResults.scannedAt,
          rawResponse: scanResults.rawResponse,
        })
        .from(scanResults)
        .innerJoin(keywords, eq(scanResults.keywordId, keywords.id))
        .innerJoin(brands, eq(keywords.brandId, brands.id))
        .where(eq(scanResults.id, idCheck.data))
        .limit(1);

      if (!row) return null;
      return {
        ...row,
        geoScore: Number(row.geoScore),
        sentimentScore: Number(row.sentimentScore),
        citations: row.citations ?? [],
        competitorsMentioned: row.competitorsMentioned ?? [],
      };
    });
  } catch (err) {
    if (isAuthError(err)) return null;
    throw err;
  }
}
