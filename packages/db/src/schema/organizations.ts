import { relations, sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { auditLogs } from './audit.js';
import { brands } from './brands.js';
import { planEnum } from './enums.js';
import { users } from './users.js';
import { apiKeysVault } from './vault.js';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Clerk Organization ID — the source of truth for membership. Mirrored
   * here so RLS can join on it without hitting Clerk on every query. */
  clerkOrgId: text('clerk_org_id').notNull().unique(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: planEnum('plan').notNull().default('starter'),
  country: text('country'),
  billingEmail: text('billing_email'),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  brands: many(brands),
  apiKeys: many(apiKeysVault),
  auditLogs: many(auditLogs),
}));

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
