import { z } from 'zod';

import { keywordDialectSchema, languageSchema, niceString, scheduleSchema, uuidSchema } from './primitives.js';

export const createKeywordSchema = z.object({
  brandId: uuidSchema,
  queryText: niceString(280),
  language: languageSchema,
  dialect: keywordDialectSchema.default('auto'),
  schedule: scheduleSchema.default('daily'),
  isActive: z.boolean().default(true),
});

export const updateKeywordSchema = createKeywordSchema.omit({ brandId: true }).partial();

/** Bulk import via CSV — up to 100 rows in one request. */
export const bulkCreateKeywordSchema = z.object({
  brandId: uuidSchema,
  rows: z
    .array(
      createKeywordSchema.omit({ brandId: true }).extend({
        queryText: niceString(280),
      }),
    )
    .min(1)
    .max(100),
});

export type CreateKeywordInput = z.infer<typeof createKeywordSchema>;
export type UpdateKeywordInput = z.infer<typeof updateKeywordSchema>;
export type BulkCreateKeywordInput = z.infer<typeof bulkCreateKeywordSchema>;
