import { z } from 'zod';

export const scanJobSchema = z.object({
  organizationId: z.string().uuid(),
  brandId: z.string().uuid(),
  keywordIds: z.array(z.string().uuid()).min(1).optional(),
  requestedByUserId: z.string().min(1).optional(),
  requestedAt: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
});

export const reportJobSchema = z.object({
  organizationId: z.string().uuid(),
  reportId: z.string().uuid(),
  requestedByUserId: z.string().min(1).optional(),
});

export const alertJobSchema = z.object({
  organizationId: z.string().uuid(),
  alertId: z.string().uuid().optional(),
  kind: z.enum(['vault_key_invalid', 'vault_key_rate_limited', 'provider_low_balance']).optional(),
  provider: z.enum(['openai', 'gemini', 'perplexity']).optional(),
  channel: z.enum(['email', 'slack']),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
  message: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const dailyMetricsJobSchema = z.object({
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  retentionDays: z.number().int().positive().max(365).default(90),
  applyRetention: z.boolean().default(true),
  requestedAt: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
});

export const vaultValidationJobSchema = z.object({
  organizationId: z.string().uuid().optional(),
  enqueueAlerts: z.boolean().default(true),
  requestedAt: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
});

export type ScanJobPayload = z.infer<typeof scanJobSchema>;
export type ReportJobPayload = z.infer<typeof reportJobSchema>;
export type AlertJobPayload = z.infer<typeof alertJobSchema>;
export type DailyMetricsJobPayload = z.infer<typeof dailyMetricsJobSchema>;
export type VaultValidationJobPayload = z.infer<typeof vaultValidationJobSchema>;
