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
  alertId: z.string().uuid(),
  channel: z.enum(['email', 'slack']),
});

export type ScanJobPayload = z.infer<typeof scanJobSchema>;
export type ReportJobPayload = z.infer<typeof reportJobSchema>;
export type AlertJobPayload = z.infer<typeof alertJobSchema>;
