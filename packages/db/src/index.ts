export * from './client.js';
export * as schema from './schema/index.js';

// Re-export the most commonly consumed table modules at the top level so
// callers can write `import { brands, organizations } from '@geosight/db'`.
export {
  apiKeysVault,
  auditLogs,
  brands,
  dailyMetrics,
  keywords,
  organizations,
  scanResults,
  users,
  waitlistEntries,
} from './schema/index.js';

export type {
  ApiKeyVault,
  AuditLog,
  Brand,
  DailyMetric,
  Keyword,
  NewApiKeyVault,
  NewAuditLog,
  NewBrand,
  NewDailyMetric,
  NewKeyword,
  NewOrganization,
  NewScanResult,
  NewUser,
  NewWaitlistEntry,
  Organization,
  ScanResult,
  User,
  WaitlistEntry,
} from './schema/index.js';
