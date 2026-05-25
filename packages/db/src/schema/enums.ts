
import {
  DIALECTS,
  KEYWORD_DIALECTS,
  LANGUAGES,
} from '@geosight/shared/constants';
import { PLAN_NAMES } from '@geosight/shared/constants';
import { AI_PROVIDERS, VAULT_PROVIDERS } from '@geosight/shared/constants';
import { ORG_ROLES } from '@geosight/shared/constants';
import { SCAN_SCHEDULES, SENTIMENT_VALUES } from '@geosight/shared/constants';
import { pgEnum } from 'drizzle-orm/pg-core';

/** Postgres enums — names match the application-side string unions in
 * @geosight/shared/constants. Drift between the two is a regression and is
 * caught by typecheck because the schema columns refer to these enums.
 */

export const planEnum = pgEnum('plan', PLAN_NAMES);
export const orgRoleEnum = pgEnum('org_role', ORG_ROLES);
export const aiProviderEnum = pgEnum('ai_provider', AI_PROVIDERS);
export const vaultProviderEnum = pgEnum('vault_provider', VAULT_PROVIDERS);
export const dialectEnum = pgEnum('dialect', DIALECTS);
export const keywordDialectEnum = pgEnum('keyword_dialect', KEYWORD_DIALECTS);
export const languageEnum = pgEnum('language', LANGUAGES);
export const sentimentEnum = pgEnum('sentiment', SENTIMENT_VALUES);
export const scanScheduleEnum = pgEnum('scan_schedule', SCAN_SCHEDULES);

export const auditActionEnum = pgEnum('audit_action', [
  'vault.key.created',
  'vault.key.decrypted',
  'vault.key.deleted',
  'vault.key.rotated',
  'vault.key.validated',
  'brand.created',
  'brand.updated',
  'brand.deleted',
  'keyword.created',
  'keyword.updated',
  'keyword.deleted',
  'scan.triggered',
  'scan.completed',
  'org.invited_member',
  'org.removed_member',
  'org.role_changed',
] as const);
