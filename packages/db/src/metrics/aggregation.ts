import { and, eq, gte, lt, sql } from 'drizzle-orm';

import type { Database } from '../client.js';
import { dailyMetrics, keywords, scanResults } from '../schema/index.js';

export type ProviderBreakdown = {
  provider: string;
  mentions: number;
  avgGeoScore: number;
};

export type CompetitorBreakdown = {
  competitor: string;
  mentions: number;
  aiSoV: number;
};

export type ScanMetricInput = {
  brandId: string;
  aiProvider: string;
  geoScore: number;
  brandMentioned: boolean;
  competitorsMentioned: readonly string[];
};

export type DailyMetricRollup = {
  brandId: string;
  metricDate: string;
  avgGeoScore: number;
  aiShareOfVoice: number;
  totalScans: number;
  brandMentions: number;
  competitorBreakdown: CompetitorBreakdown[];
  providerBreakdown: ProviderBreakdown[];
};

export type AggregateDailyMetricsOptions = {
  db: Database;
  day?: Date;
};

export type RetentionOptions = {
  db: Database;
  now?: Date;
  retentionDays?: number;
};

const dayMs = 24 * 60 * 60 * 1000;

export function utcDayRange(day: Date): { start: Date; end: Date; metricDate: string } {
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const end = new Date(start.getTime() + dayMs);
  return { start, end, metricDate: start.toISOString().slice(0, 10) };
}

export function computeAiShareOfVoice(brandMentions: number, competitorMentions: number): number {
  const totalVoiceMentions = brandMentions + competitorMentions;
  if (totalVoiceMentions <= 0) return 0;
  return (brandMentions / totalVoiceMentions) * 100;
}

export function rollupDailyMetrics(
  metricDate: string,
  scans: readonly ScanMetricInput[],
): DailyMetricRollup[] {
  type Bucket = {
    brandId: string;
    scoreSum: number;
    scanCount: number;
    brandMentions: number;
    competitorCounts: Map<string, number>;
    providerCounts: Map<string, { mentions: number; scoreSum: number; scanCount: number }>;
  };

  const buckets = new Map<string, Bucket>();

  for (const scan of scans) {
    let bucket = buckets.get(scan.brandId);
    if (!bucket) {
      bucket = {
        brandId: scan.brandId,
        scoreSum: 0,
        scanCount: 0,
        brandMentions: 0,
        competitorCounts: new Map(),
        providerCounts: new Map(),
      };
      buckets.set(scan.brandId, bucket);
    }

    bucket.scoreSum += scan.geoScore;
    bucket.scanCount += 1;
    if (scan.brandMentioned) bucket.brandMentions += 1;

    for (const competitor of scan.competitorsMentioned) {
      bucket.competitorCounts.set(competitor, (bucket.competitorCounts.get(competitor) ?? 0) + 1);
    }

    const provider = bucket.providerCounts.get(scan.aiProvider) ?? {
      mentions: 0,
      scoreSum: 0,
      scanCount: 0,
    };
    if (scan.brandMentioned) provider.mentions += 1;
    provider.scoreSum += scan.geoScore;
    provider.scanCount += 1;
    bucket.providerCounts.set(scan.aiProvider, provider);
  }

  return [...buckets.values()].map((bucket) => {
    const competitorMentions = [...bucket.competitorCounts.values()].reduce(
      (sum, count) => sum + count,
      0,
    );
    const voiceDenominator = bucket.brandMentions + competitorMentions;

    return {
      brandId: bucket.brandId,
      metricDate,
      avgGeoScore: bucket.scoreSum / bucket.scanCount,
      aiShareOfVoice: computeAiShareOfVoice(bucket.brandMentions, competitorMentions),
      totalScans: bucket.scanCount,
      brandMentions: bucket.brandMentions,
      competitorBreakdown: [...bucket.competitorCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([competitor, mentions]) => ({
          competitor,
          mentions,
          aiSoV: voiceDenominator === 0 ? 0 : (mentions / voiceDenominator) * 100,
        })),
      providerBreakdown: [...bucket.providerCounts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([provider, values]) => ({
          provider,
          mentions: values.mentions,
          avgGeoScore: values.scoreSum / values.scanCount,
        })),
    };
  });
}

export async function aggregateDailyMetrics({
  db,
  day = new Date(Date.now() - dayMs),
}: AggregateDailyMetricsOptions): Promise<{
  metricDate: string;
  brandsAggregated: number;
  scansAggregated: number;
}> {
  const { start, end, metricDate } = utcDayRange(day);

  const rows = await db
    .select({
      brandId: keywords.brandId,
      aiProvider: scanResults.aiProvider,
      geoScore: scanResults.geoScore,
      brandMentioned: scanResults.brandMentioned,
      competitorsMentioned: scanResults.competitorsMentioned,
    })
    .from(scanResults)
    .innerJoin(keywords, eq(scanResults.keywordId, keywords.id))
    .where(and(gte(scanResults.scannedAt, start), lt(scanResults.scannedAt, end)));

  const rollups = rollupDailyMetrics(metricDate, rows);

  if (rollups.length > 0) {
    await db
      .insert(dailyMetrics)
      .values(rollups)
      .onConflictDoUpdate({
        target: [dailyMetrics.brandId, dailyMetrics.metricDate],
        set: {
          avgGeoScore: sql`excluded.avg_geo_score`,
          aiShareOfVoice: sql`excluded.ai_share_of_voice`,
          totalScans: sql`excluded.total_scans`,
          brandMentions: sql`excluded.brand_mentions`,
          competitorBreakdown: sql`excluded.competitor_breakdown`,
          providerBreakdown: sql`excluded.provider_breakdown`,
        },
      });
  }

  return {
    metricDate,
    brandsAggregated: rollups.length,
    scansAggregated: rows.length,
  };
}

export async function deleteExpiredScanResults({
  db,
  now = new Date(),
  retentionDays = 90,
}: RetentionOptions): Promise<{ deletedRows: number; cutoff: Date }> {
  const cutoff = new Date(now.getTime() - retentionDays * dayMs);
  const deleted = await db
    .delete(scanResults)
    .where(lt(scanResults.scannedAt, cutoff))
    .returning({ id: scanResults.id });

  return { deletedRows: deleted.length, cutoff };
}
