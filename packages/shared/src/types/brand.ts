import type { BrandId, OrgId } from './ids.js';

/** A tracked brand — the unit of analysis. */
export interface BrandRecord {
  readonly id: BrandId;
  readonly orgId: OrgId;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly aliasesAr: readonly string[];
  readonly aliasesEn: readonly string[];
  readonly website: string | null;
  readonly competitors: readonly string[];
  readonly industry: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
