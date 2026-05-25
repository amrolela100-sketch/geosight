/** GEO Score weights — mirror docs/ROADMAP.md § Week 12.
 *
 * Sum is 1.0. From the Agency plan onward these weights become customer-configurable
 * via the dashboard — the canonical defaults live here.
 */
export const GEO_SCORE_WEIGHTS = {
  brandMention: 0.35,
  mentionPosition: 0.15,
  citationQuality: 0.25,
  competitorAbsence: 0.1,
  sentiment: 0.15,
} as const;

export const GEO_SCORE_RANGE = { min: 0, max: 100 } as const;

export const SENTIMENT_VALUES = ['positive', 'neutral', 'negative'] as const;
export type Sentiment = (typeof SENTIMENT_VALUES)[number];

export const SCAN_SCHEDULES = ['daily', 'weekly', 'custom'] as const;
export type ScanSchedule = (typeof SCAN_SCHEDULES)[number];
