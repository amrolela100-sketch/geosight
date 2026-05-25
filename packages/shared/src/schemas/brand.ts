import { z } from 'zod';

import { niceString, optionalUrl } from './primitives.js';

export const createBrandSchema = z.object({
  nameAr: niceString(120),
  nameEn: niceString(120),
  aliasesAr: z.array(niceString(120)).max(20).default([]),
  aliasesEn: z.array(niceString(120)).max(20).default([]),
  website: optionalUrl.optional(),
  competitors: z.array(niceString(120)).max(30).default([]),
  industry: z.string().trim().max(120).optional(),
});

export const updateBrandSchema = createBrandSchema.partial();

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
