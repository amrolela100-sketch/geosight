import { relations, sql } from 'drizzle-orm';
import {
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { brands } from './brands.js';

/** Daily roll-up per brand × day. Written by the aggregation cron job;
 * scan_results is then safe to age out at 90 days while metrics persist
 * forever (cheap, small rows). */
export const dailyMetrics = pgTable(
  'daily_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    metricDate: date('metric_date').notNull(),
    avgGeoScore: doublePrecision('avg_geo_score').notNull(),
    aiShareOfVoice: doublePrecision('ai_share_of_voice').notNull(),
    totalScans: integer('total_scans').notNull(),
    brandMentions: integer('brand_mentions').notNull(),
    /** { competitor: string, mentions: number, aiSoV: number }[] */
    competitorBreakdown: jsonb('competitor_breakdown')
      .$type<Array<{ competitor: string; mentions: number; aiSoV: number }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** { provider: 'chatgpt'|'gemini'|'perplexity', mentions: number, avgGeoScore: number }[] */
    providerBreakdown: jsonb('provider_breakdown')
      .$type<Array<{ provider: string; mentions: number; avgGeoScore: number }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    brandIdx: index('metrics_brand_idx').on(table.brandId),
    /** Exactly one row per (brand, day). */
    uniqueBrandDate: uniqueIndex('metrics_brand_date_unique').on(table.brandId, table.metricDate),
  }),
);

export const dailyMetricsRelations = relations(dailyMetrics, ({ one }) => ({
  brand: one(brands, {
    fields: [dailyMetrics.brandId],
    references: [brands.id],
  }),
}));

export type DailyMetric = typeof dailyMetrics.$inferSelect;
export type NewDailyMetric = typeof dailyMetrics.$inferInsert;
