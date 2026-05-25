import { relations, sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { keywords } from './keywords.js';
import { organizations } from './organizations.js';

export const brands = pgTable(
  'brands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    /** Arabic aliases — transliterations, common typos, sub-brands. */
    aliasesAr: text('aliases_ar')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** English aliases — same idea, captures English-in-Arabic mentions. */
    aliasesEn: text('aliases_en')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    website: text('website'),
    /** Competitors as free-text — tracked across all keywords. */
    competitors: text('competitors')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    industry: text('industry'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    orgIdx: index('brands_org_idx').on(table.orgId),
  }),
);

export const brandsRelations = relations(brands, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [brands.orgId],
    references: [organizations.id],
  }),
  keywords: many(keywords),
}));

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
