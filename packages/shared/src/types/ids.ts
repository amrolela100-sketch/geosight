/** Branded ID types — preserve a single underlying string representation but
 * make it a type error to pass a brand id where an org id is expected, etc.
 */

declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type OrgId = Brand<string, 'OrgId'>;
export type UserId = Brand<string, 'UserId'>;
export type ClerkUserId = Brand<string, 'ClerkUserId'>;
export type BrandId = Brand<string, 'BrandId'>;
export type KeywordId = Brand<string, 'KeywordId'>;
export type ScanResultId = Brand<string, 'ScanResultId'>;
export type ApiKeyVaultId = Brand<string, 'ApiKeyVaultId'>;
export type AuditLogId = Brand<string, 'AuditLogId'>;
export type WaitlistEntryId = Brand<string, 'WaitlistEntryId'>;

/** Cast a raw string into a typed id. Use at trust boundaries (DB reads,
 * decoded JWTs, validated input) — never sprinkle through business logic.
 */
export const asOrgId = (s: string): OrgId => s as OrgId;
export const asUserId = (s: string): UserId => s as UserId;
export const asClerkUserId = (s: string): ClerkUserId => s as ClerkUserId;
export const asBrandId = (s: string): BrandId => s as BrandId;
export const asKeywordId = (s: string): KeywordId => s as KeywordId;
export const asScanResultId = (s: string): ScanResultId => s as ScanResultId;
export const asApiKeyVaultId = (s: string): ApiKeyVaultId => s as ApiKeyVaultId;
export const asAuditLogId = (s: string): AuditLogId => s as AuditLogId;
export const asWaitlistEntryId = (s: string): WaitlistEntryId => s as WaitlistEntryId;
