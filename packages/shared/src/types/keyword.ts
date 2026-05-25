import type { KeywordDialect, Language } from '../constants/dialects.js';
import type { ScanSchedule } from '../constants/geo-score.js';

import type { BrandId, KeywordId } from './ids.js';

export interface KeywordRecord {
  readonly id: KeywordId;
  readonly brandId: BrandId;
  readonly queryText: string;
  readonly language: Language;
  readonly dialect: KeywordDialect;
  readonly schedule: ScanSchedule;
  readonly isActive: boolean;
  readonly lastScannedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
