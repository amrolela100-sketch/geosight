import { relations, sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { auditActionEnum } from './enums.js';
import { organizations } from './organizations.js';

/** Append-only audit trail. Every BYOK vault operation MUST land here
 * (see feedback-byok-from-day-one memory). */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** Clerk user id of the actor — null when the action is system-initiated. */
    actorClerkUserId: text('actor_clerk_user_id'),
    action: auditActionEnum('action').notNull(),
    /** Free-form entity reference (e.g. 'brand:<uuid>', 'vault_key:<uuid>'). */
    entityRef: text('entity_ref'),
    /** Structured context. NEVER stores plaintext secrets. */
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    orgIdx: index('audit_org_idx').on(table.orgId),
    orgTimeIdx: index('audit_org_time_idx').on(table.orgId, table.createdAt),
    actionIdx: index('audit_action_idx').on(table.action),
  }),
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.orgId],
    references: [organizations.id],
  }),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
