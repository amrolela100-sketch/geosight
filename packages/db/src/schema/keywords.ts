import { relations, sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { brands } from './brands.js';
import { keywordDialectEnum, languageEnum, scanScheduleEnum } from './enums.js';
import { scanResults } from './scans.js';

export const keywords = pgTable(
  'keywords',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    queryText: text('query_text').notNull(),
    language: languageEnum('language').notNull().default('ar'),
    dialect: keywordDialectEnum('dialect').notNull().default('auto'),
    schedule: scanScheduleEnum('schedule').notNull().default('daily'),
    isActive: boolean('is_active').notNull().default(true),
    lastScannedAt: timestamp('last_scanned_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    brandIdx: index('keywords_brand_idx').on(table.brandId),
    activeIdx: index('keywords_active_idx').on(table.isActive, table.lastScannedAt),
  }),
);

export const keywordsRelations = relations(keywords, ({ one, many }) => ({
  brand: one(brands, {
    fields: [keywords.brandId],
    references: [brands.id],
  }),
  scanResults: many(scanResults),
}));

export type Keyword = typeof keywords.$inferSelect;
export type NewKeyword = typeof keywords.$inferInsert;
