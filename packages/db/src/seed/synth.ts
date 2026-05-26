/** Synthesizes 200 historical scan_results + per-day daily_metrics rollups
 * from the static fixtures. Deterministic — uses a seeded LCG so the same
 * seed always produces the same rows. */

import type { AiProvider, Dialect } from '@geosight/shared/constants';

import type { NewDailyMetric, NewScanResult } from '../schema/index.js';

const PROVIDERS: readonly AiProvider[] = ['chatgpt', 'gemini', 'perplexity'];
const DIALECTS: readonly Dialect[] = ['msa', 'gulf', 'levantine', 'egyptian'];

/** Minimal LCG so the seeder doesn't pull a PRNG dependency. */
class Lcg {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }
  /** Returns next value in [0, 1). */
  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x1_0000_0000;
  }
  /** Returns next integer in [0, max). */
  int(max: number): number {
    return Math.floor(this.next() * max);
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)]!;
  }
  /** Returns true with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }
}

export interface ScanContextLookup {
  /** Returns the brand handle for a given keyword id. */
  brandHandleForKeyword(keywordId: string): string;
  /** Snippet for (brandHandle, provider, sentiment). */
  snippet(brandHandle: string, provider: AiProvider, sentiment: 'positive' | 'neutral' | 'negative'): string;
  /** Competitor list for a brand handle. */
  competitorsFor(brandHandle: string): readonly string[];
  /** Citation pool — pulled at random when sentiment != negative. */
  citationsFor(brandHandle: string, provider: AiProvider): readonly string[];
}

const CITATIONS: Readonly<Record<string, Readonly<Record<AiProvider, readonly string[]>>>> = {
  saudia: {
    chatgpt: [],
    gemini: ['https://www.skytrax.com/airline-ratings', 'https://www.saudia.com'],
    perplexity: ['https://www.saudia.com', 'https://en.wikipedia.org/wiki/Saudia'],
  },
  stc: {
    chatgpt: [],
    gemini: ['https://www.stc.com.sa'],
    perplexity: ['https://www.stc.com.sa', 'https://www.statista.com/topics/saudi-telecom/'],
  },
  aramco: {
    chatgpt: [],
    gemini: ['https://www.aramco.com'],
    perplexity: ['https://www.aramco.com', 'https://www.reuters.com/business/energy/'],
  },
  talabat: {
    chatgpt: [],
    gemini: ['https://www.talabat.com'],
    perplexity: ['https://www.talabat.com', 'https://www.hungerstation.com'],
  },
  careem: {
    chatgpt: [],
    gemini: ['https://www.careem.com'],
    perplexity: ['https://www.careem.com', 'https://en.wikipedia.org/wiki/Careem'],
  },
};

export function citationPool(brandHandle: string, provider: AiProvider): readonly string[] {
  return CITATIONS[brandHandle]?.[provider] ?? [];
}

export interface SynthesizeResult {
  readonly scans: readonly NewScanResult[];
  /** brandId -> per-day rollups already aggregated from the synthesized scans. */
  readonly dailyMetrics: readonly NewDailyMetric[];
}

export interface SynthesizeOptions {
  readonly seed: number;
  readonly totalScans: number;
  readonly days: number;
  /** Sorted list of (brandHandle, brandId, keywordIds[]) the synthesizer can pick from. */
  readonly brands: ReadonlyArray<{
    readonly handle: string;
    readonly brandId: string;
    readonly competitors: readonly string[];
    readonly keywords: ReadonlyArray<{ id: string; dialect: Dialect | 'auto' }>;
  }>;
  readonly snippets: ScanContextLookup['snippet'];
}

/** Build 200 scan_results spread across `days` days × brands × providers,
 * plus one daily_metrics row per (brand, day) aggregated from those scans. */
export function synthesizeHistory(opts: SynthesizeOptions): SynthesizeResult {
  const rng = new Lcg(opts.seed);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const scans: NewScanResult[] = [];

  // Distribute scans roughly evenly across days. Each scan picks a random
  // brand, keyword on that brand, and provider.
  const flatKeywords = opts.brands.flatMap((b) =>
    b.keywords.map((k) => ({ ...k, brandHandle: b.handle, brandId: b.brandId, competitors: b.competitors })),
  );

  for (let i = 0; i < opts.totalScans; i++) {
    const dayOffset = rng.int(opts.days);
    // Spread within the day across business hours, slight noise into evenings.
    const hour = 8 + rng.int(12);
    const minute = rng.int(60);
    const scannedAt = new Date(now - dayOffset * dayMs);
    scannedAt.setHours(hour, minute, 0, 0);

    const kw = rng.pick(flatKeywords);
    const provider = rng.pick(PROVIDERS);
    const brandMentioned = rng.chance(0.74);
    const sentiment = !brandMentioned
      ? 'neutral'
      : rng.chance(0.62)
        ? 'positive'
        : rng.chance(0.55)
          ? 'neutral'
          : 'negative';

    const baseScore = brandMentioned
      ? sentiment === 'positive'
        ? 60 + rng.int(36)
        : sentiment === 'neutral'
          ? 45 + rng.int(25)
          : 20 + rng.int(20)
      : 8 + rng.int(20);

    const competitors = brandMentioned
      ? kw.competitors.filter(() => rng.chance(0.32)).slice(0, 3)
      : kw.competitors.filter(() => rng.chance(0.55)).slice(0, 4);

    const citations = brandMentioned ? citationPool(kw.brandHandle, provider).filter(() => rng.chance(0.6)) : [];

    const snippet = brandMentioned
      ? opts.snippets(kw.brandHandle, provider, sentiment as 'positive' | 'neutral' | 'negative')
      : null;

    const detectedDialect =
      kw.dialect === 'auto' ? rng.pick(DIALECTS) : (kw.dialect as Dialect);

    scans.push({
      keywordId: kw.id,
      aiProvider: provider,
      rawResponse: {
        synthesized: true,
        provider,
        snippet,
        captured_at: scannedAt.toISOString(),
      },
      geoScore: baseScore,
      brandMentioned,
      mentionPosition: brandMentioned ? rng.int(900) : null,
      mentionRank: brandMentioned ? 1 + rng.int(3) : null,
      sentiment,
      sentimentScore:
        sentiment === 'positive'
          ? 0.25 + rng.next() * 0.7
          : sentiment === 'negative'
            ? -0.85 + rng.next() * 0.45
            : -0.2 + rng.next() * 0.4,
      citations,
      competitorsMentioned: competitors,
      contextSnippet: snippet,
      detectedDialect,
      latencyMs: 280 + rng.int(2200),
      scannedAt,
    });
  }

  // Aggregate into daily_metrics per (brand, day).
  type Bucket = {
    brandId: string;
    brandHandle: string;
    competitorsMap: Map<string, number>;
    providerMap: Map<AiProvider, { mentions: number; sumScore: number }>;
    scoreSum: number;
    scanCount: number;
    mentionCount: number;
  };
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const buckets = new Map<string, Bucket>();

  for (const scan of scans) {
    const flat = flatKeywords.find((k) => k.id === scan.keywordId)!;
    const key = `${flat.brandId}|${dayKey(scan.scannedAt as Date)}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        brandId: flat.brandId,
        brandHandle: flat.brandHandle,
        competitorsMap: new Map(),
        providerMap: new Map(),
        scoreSum: 0,
        scanCount: 0,
        mentionCount: 0,
      };
      buckets.set(key, bucket);
    }
    bucket.scoreSum += scan.geoScore;
    bucket.scanCount += 1;
    if (scan.brandMentioned) bucket.mentionCount += 1;
    for (const c of scan.competitorsMentioned ?? []) {
      bucket.competitorsMap.set(c, (bucket.competitorsMap.get(c) ?? 0) + 1);
    }
    const pBucket = bucket.providerMap.get(scan.aiProvider) ?? { mentions: 0, sumScore: 0 };
    if (scan.brandMentioned) pBucket.mentions += 1;
    pBucket.sumScore += scan.geoScore;
    bucket.providerMap.set(scan.aiProvider, pBucket);
  }

  const dailyMetrics: NewDailyMetric[] = [];
  for (const [key, b] of buckets) {
    const day = key.split('|')[1]!;
    const totalCompetitorMentions = [...b.competitorsMap.values()].reduce((a, c) => a + c, 0);
    const aiShareOfVoice =
      b.mentionCount + totalCompetitorMentions === 0
        ? 0
        : (b.mentionCount / (b.mentionCount + totalCompetitorMentions)) * 100;
    dailyMetrics.push({
      brandId: b.brandId,
      metricDate: day,
      avgGeoScore: b.scoreSum / b.scanCount,
      aiShareOfVoice,
      totalScans: b.scanCount,
      brandMentions: b.mentionCount,
      competitorBreakdown: [...b.competitorsMap.entries()]
        .sort((a, c) => c[1] - a[1])
        .map(([competitor, mentions]) => ({
          competitor,
          mentions,
          aiSoV: totalCompetitorMentions === 0 ? 0 : (mentions / (b.mentionCount + totalCompetitorMentions)) * 100,
        })),
      providerBreakdown: [...b.providerMap.entries()].map(([provider, p]) => ({
        provider,
        mentions: p.mentions,
        avgGeoScore: p.sumScore / Math.max(1, b.scanCount),
      })),
    });
  }

  return { scans, dailyMetrics };
}
