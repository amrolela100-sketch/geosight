import { relations, sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { dialectEnum, orgRoleEnum } from './enums.js';
import { organizations } from './organizations.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Clerk user ID — single source of truth for identity. */
    clerkUserId: text('clerk_user_id').notNull().unique(),
    email: text('email').notNull(),
    fullName: text('full_name'),
    avatarUrl: text('avatar_url'),
    /** The user's current org. Users move between orgs in Clerk; the
     * webhook updates this column whenever the active org changes. */
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    role: orgRoleEnum('role').notNull().default('member'),
    /** Preferred Arabic dialect for the dashboard greetings + LLM prompts. */
    preferredDialect: dialectEnum('preferred_dialect').notNull().default('msa'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    orgIdx: index('users_org_idx').on(table.orgId),
    emailIdx: index('users_email_idx').on(table.email),
  }),
);

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
