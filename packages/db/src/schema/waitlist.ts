import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Pre-launch waitlist signups from the landing page.
 *
 * Not tenant-scoped — these are anonymous leads before they have an org.
 * Public insert via the landing-page route is rate-limited at the edge.
 */
export const waitlistEntries = pgTable(
  'waitlist_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    company: text('company'),
    website: text('website'),
    country: text('country'),
    brandCount: integer('brand_count'),
    notes: text('notes'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    invitedAt: timestamp('invited_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    emailIdx: index('waitlist_email_idx').on(table.email),
    createdIdx: index('waitlist_created_idx').on(table.createdAt),
  }),
);

export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
export type NewWaitlistEntry = typeof waitlistEntries.$inferInsert;
