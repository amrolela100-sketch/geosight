import { z } from 'zod';

import { niceString, optionalUrl } from './primitives.js';

export const waitlistEntrySchema = z.object({
  fullName: niceString(120),
  email: z.string().email(),
  company: niceString(160).optional(),
  website: optionalUrl.optional(),
  country: z.string().trim().max(80).optional(),
  /** Approx number of brands the lead expects to track. */
  brandCount: z.coerce.number().int().min(1).max(1000).optional(),
  /** Optional free-text "what would you use GeoSight for" — 1k chars max. */
  notes: z.string().trim().max(1000).optional(),
  /** UTM tracking — set by the landing page, never required from the user. */
  utmSource: z.string().trim().max(80).optional(),
  utmMedium: z.string().trim().max(80).optional(),
  utmCampaign: z.string().trim().max(80).optional(),
});

export type WaitlistEntryInput = z.infer<typeof waitlistEntrySchema>;
