import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { vaultProviderEnum } from './enums.js';
import { organizations } from './organizations.js';

/** bytea column — Postgres binary, exposed as Node Buffer. */
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return 'bytea';
  },
});

/** BYOK key vault — customer-supplied API keys, encrypted at rest with
 * AES-256-GCM. The master key lives only in api/worker env vars; this
 * table never holds plaintext.
 *
 * Reads ALWAYS go through KeyVaultService.decrypt() in @geosight/api so the
 * decryption step is centralised, audited, and rate-limited.
 */
export const apiKeysVault = pgTable(
  'api_keys_vault',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    provider: vaultProviderEnum('provider').notNull(),
    /** AES-256-GCM ciphertext of the API key. */
    encryptedKey: bytea('encrypted_key').notNull(),
    /** Per-record initialisation vector (12 bytes). */
    iv: bytea('iv').notNull(),
    /** GCM authentication tag (16 bytes). */
    authTag: bytea('auth_tag').notNull(),
    /** Last 4 chars of the cleartext key — safe to show in UI for identification. */
    lastFour: text('last_four').notNull(),
    isValid: boolean('is_valid').notNull().default(true),
    lastValidatedAt: timestamp('last_validated_at', { withTimezone: true }),
    /** Optional human label, e.g. "Production OpenAI". */
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    orgIdx: index('vault_org_idx').on(table.orgId),
    /** Each org has at most one active key per provider at a time. */
    uniqueOrgProvider: uniqueIndex('vault_org_provider_unique').on(table.orgId, table.provider),
  }),
);

export const apiKeysVaultRelations = relations(apiKeysVault, ({ one }) => ({
  organization: one(organizations, {
    fields: [apiKeysVault.orgId],
    references: [organizations.id],
  }),
}));

export type ApiKeyVault = typeof apiKeysVault.$inferSelect;
export type NewApiKeyVault = typeof apiKeysVault.$inferInsert;
