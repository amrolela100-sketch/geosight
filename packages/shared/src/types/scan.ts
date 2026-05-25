import type { Dialect } from '../constants/dialects.js';
import type { Sentiment } from '../constants/geo-score.js';
import type { AiProvider } from '../constants/providers.js';

import type { KeywordId, ScanResultId } from './ids.js';

export interface ScanResultRecord {
  readonly id: ScanResultId;
  readonly keywordId: KeywordId;
  readonly aiProvider: AiProvider;
  /** Sanitized provider payload — raw text + citations, NOT secret material. */
  readonly rawResponse: Record<string, unknown>;
  readonly geoScore: number;
  readonly brandMentioned: boolean;
  readonly mentionPosition: number | null;
  readonly mentionRank: number | null;
  readonly sentiment: Sentiment;
  readonly sentimentScore: number;
  readonly citations: readonly string[];
  readonly competitorsMentioned: readonly string[];
  readonly contextSnippet: string | null;
  readonly detectedDialect: Dialect | null;
  readonly latencyMs: number;
  readonly scannedAt: Date;
}

export interface CompetitorBreakdown {
  readonly competitor: string;
  readonly mentions: number;
  readonly aiSoV: number;
}

export interface ProviderBreakdown {
  readonly provider: AiProvider;
  readonly mentions: number;
  readonly avgGeoScore: number;
}
