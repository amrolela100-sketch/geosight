import { describe, expect, it } from 'vitest';

import { computeAiShareOfVoice, rollupDailyMetrics, utcDayRange } from '../src/index.js';

describe('daily metrics aggregation', () => {
  it('computes UTC day ranges without local timezone drift', () => {
    const range = utcDayRange(new Date('2026-05-26T23:30:00.000Z'));

    expect(range.metricDate).toBe('2026-05-26');
    expect(range.start.toISOString()).toBe('2026-05-26T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-05-27T00:00:00.000Z');
  });

  it('computes AISoV from brand mentions versus competitor mentions', () => {
    expect(computeAiShareOfVoice(8, 2)).toBe(80);
    expect(computeAiShareOfVoice(0, 0)).toBe(0);
  });

  it('rolls scans up per brand with competitor and provider breakdowns', () => {
    const [rollup] = rollupDailyMetrics('2026-05-26', [
      {
        brandId: 'brand-a',
        aiProvider: 'chatgpt',
        geoScore: 80,
        brandMentioned: true,
        competitorsMentioned: ['Comp A'],
      },
      {
        brandId: 'brand-a',
        aiProvider: 'chatgpt',
        geoScore: 60,
        brandMentioned: false,
        competitorsMentioned: ['Comp A', 'Comp B'],
      },
      {
        brandId: 'brand-a',
        aiProvider: 'gemini',
        geoScore: 100,
        brandMentioned: true,
        competitorsMentioned: [],
      },
    ]);

    expect(rollup).toMatchObject({
      brandId: 'brand-a',
      metricDate: '2026-05-26',
      avgGeoScore: 80,
      aiShareOfVoice: 40,
      totalScans: 3,
      brandMentions: 2,
    });
    expect(rollup?.competitorBreakdown).toEqual([
      { competitor: 'Comp A', mentions: 2, aiSoV: 40 },
      { competitor: 'Comp B', mentions: 1, aiSoV: 20 },
    ]);
    expect(rollup?.providerBreakdown).toEqual([
      { provider: 'chatgpt', mentions: 1, avgGeoScore: 70 },
      { provider: 'gemini', mentions: 1, avgGeoScore: 100 },
    ]);
  });
});
