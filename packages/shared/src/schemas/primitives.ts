import { z } from 'zod';

import { DIALECTS, KEYWORD_DIALECTS, LANGUAGES } from '../constants/dialects.js';
import { SCAN_SCHEDULES, SENTIMENT_VALUES } from '../constants/geo-score.js';
import { PLAN_NAMES } from '../constants/plans.js';
import { AI_PROVIDERS, VAULT_PROVIDERS } from '../constants/providers.js';
import { ORG_ROLES } from '../constants/roles.js';

export const uuidSchema = z.string().uuid();
export const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'must be a kebab-case slug');

export const planSchema = z.enum(PLAN_NAMES);
export const aiProviderSchema = z.enum(AI_PROVIDERS);
export const vaultProviderSchema = z.enum(VAULT_PROVIDERS);
export const dialectSchema = z.enum(DIALECTS);
export const keywordDialectSchema = z.enum(KEYWORD_DIALECTS);
export const languageSchema = z.enum(LANGUAGES);
export const sentimentSchema = z.enum(SENTIMENT_VALUES);
export const scheduleSchema = z.enum(SCAN_SCHEDULES);
export const orgRoleSchema = z.enum(ORG_ROLES);

/** A non-empty trimmed string, ≤ length. Used for user-typed names. */
export const niceString = (max = 200) =>
  z.string().trim().min(1, 'required').max(max, `≤ ${max} characters`);

/** Optional URL field — accepts empty string as null. */
export const optionalUrl = z
  .union([z.string().url(), z.literal('')])
  .transform((v) => (v === '' ? null : v));

/** Pagination cursor schema — used by every listing endpoint. */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type PaginationInput = z.infer<typeof paginationSchema>;
