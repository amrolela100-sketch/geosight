import { z } from 'zod';

import { aiProviderSchema, dialectSchema, sentimentSchema, uuidSchema } from './primitives.js';

export const triggerScanSchema = z.object({
  keywordId: uuidSchema,
  providers: z.array(aiProviderSchema).min(1).max(3).optional(),
});

export const scanResultDtoSchema = z.object({
  id: uuidSchema,
  keywordId: uuidSchema,
  aiProvider: aiProviderSchema,
  geoScore: z.number().min(0).max(100),
  brandMentioned: z.boolean(),
  mentionPosition: z.number().int().nullable(),
  mentionRank: z.number().int().min(1).nullable(),
  sentiment: sentimentSchema,
  sentimentScore: z.number().min(-1).max(1),
  citations: z.array(z.string().url()),
  competitorsMentioned: z.array(z.string()),
  contextSnippet: z.string().nullable(),
  detectedDialect: dialectSchema.nullable(),
  latencyMs: z.number().int().min(0),
  scannedAt: z.coerce.date(),
});

export type TriggerScanInput = z.infer<typeof triggerScanSchema>;
export type ScanResultDto = z.infer<typeof scanResultDtoSchema>;
