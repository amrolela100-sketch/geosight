import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { aiProviderEnum, dialectEnum, sentimentEnum } from './enums.js';
import { keywords } from './keywords.js';

export const scanResults = pgTable(
  'scan_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    keywordId: uuid('keyword_id')
      .notNull()
      .references(() => keywords.id, { onDelete: 'cascade' }),
    aiProvider: aiProviderEnum('ai_provider').notNull(),
    /** Sanitized provider payload (text + citations + grounding meta).
     * Secrets (api keys, auth headers) are stripped before persistence. */
    rawResponse: jsonb('raw_response').$type<Record<string, unknown>>().notNull(),
    geoScore: doublePrecision('geo_score').notNull(),
    brandMentioned: boolean('brand_mentioned').notNull(),
    /** 0-indexed char offset of the first brand mention in the normalized text. */
    mentionPosition: integer('mention_position'),
    /** 1-indexed rank among all brand-like entities found in the response. */
    mentionRank: integer('mention_rank'),
    sentiment: sentimentEnum('sentiment').notNull().default('neutral'),
    /** -1.0..1.0 fine-grained sentiment score (Phase 2 transformer). */
    sentimentScore: doublePrecision('sentiment_score').notNull().default(0),
    citations: text('citations')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    competitorsMentioned: text('competitors_mentioned')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    contextSnippet: text('context_snippet'),
    detectedDialect: dialectEnum('detected_dialect'),
    latencyMs: integer('latency_ms').notNull(),
    scannedAt: timestamp('scanned_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    keywordIdx: index('scan_keyword_idx').on(table.keywordId),
    keywordTimeIdx: index('scan_keyword_time_idx').on(table.keywordId, table.scannedAt),
    /** Used by daily-aggregation cron to bound the scan window. */
    timeIdx: index('scan_time_idx').on(table.scannedAt),
  }),
);

export const scanResultsRelations = relations(scanResults, ({ one }) => ({
  keyword: one(keywords, {
    fields: [scanResults.keywordId],
    references: [keywords.id],
  }),
}));

export type ScanResult = typeof scanResults.$inferSelect;
export type NewScanResult = typeof scanResults.$inferInsert;
