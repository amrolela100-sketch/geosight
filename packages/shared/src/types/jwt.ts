import type { OrgRole } from '../constants/roles.js';

import type { ClerkUserId, OrgId } from './ids.js';

/** Shape of the Clerk-issued JWT consumed by Supabase RLS.
 *
 * Lives in @geosight/shared because both Next.js middleware and the Fastify
 * api layer parse this — single source of truth prevents drift.
 *
 * See project-clerk-supabase-rls memory for the JWT template configuration.
 */
export interface SupabaseJwtClaims {
  readonly aud: 'authenticated';
  readonly role: 'authenticated';
  readonly user_id: ClerkUserId;
  readonly org_id: OrgId;
  readonly org_role: OrgRole;
  readonly exp: number;
  readonly iat: number;
}
