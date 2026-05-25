-- ─────────────────────────────────────────────────────────────────────────────
-- GeoSight — Row-Level Security policies.
--
-- This file is hand-curated (drizzle-kit doesn't generate RLS). After
-- `pnpm db:generate` produces the table DDL, this file is applied as a
-- separate migration via `db:migrate` — it's idempotent so re-running is safe.
--
-- See project-clerk-supabase-rls memory for the auth model.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: read a claim from the Clerk-issued JWT set via withClerkAuth().
CREATE OR REPLACE FUNCTION geosight_jwt_claim(claim text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json ->> claim,
    NULL
  );
$$;

CREATE OR REPLACE FUNCTION geosight_current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(geosight_jwt_claim('org_id'), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION geosight_current_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT geosight_jwt_claim('org_role');
$$;

-- ── Enable RLS on every multi-tenant table. ─────────────────────────────────
ALTER TABLE organizations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys_vault   ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands           ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_results     ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;

-- waitlist_entries is intentionally not tenant-scoped; we apply different
-- policies (anyone can insert; only service role can read).
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;

-- ── organizations: each user sees only their own org. ───────────────────────
DROP POLICY IF EXISTS "orgs_select_own" ON organizations;
CREATE POLICY "orgs_select_own" ON organizations
  FOR SELECT TO authenticated
  USING (id = geosight_current_org_id());

DROP POLICY IF EXISTS "orgs_update_own_admin" ON organizations;
CREATE POLICY "orgs_update_own_admin" ON organizations
  FOR UPDATE TO authenticated
  USING (id = geosight_current_org_id() AND geosight_current_role() IN ('owner', 'admin'))
  WITH CHECK (id = geosight_current_org_id());

-- ── users: each user sees teammates in the same org. ────────────────────────
DROP POLICY IF EXISTS "users_select_same_org" ON users;
CREATE POLICY "users_select_same_org" ON users
  FOR SELECT TO authenticated
  USING (org_id = geosight_current_org_id());

DROP POLICY IF EXISTS "users_update_self" ON users;
CREATE POLICY "users_update_self" ON users
  FOR UPDATE TO authenticated
  USING (org_id = geosight_current_org_id())
  WITH CHECK (org_id = geosight_current_org_id());

-- ── api_keys_vault: tenant-scoped + admin-only writes. ──────────────────────
DROP POLICY IF EXISTS "vault_select_own_org" ON api_keys_vault;
CREATE POLICY "vault_select_own_org" ON api_keys_vault
  FOR SELECT TO authenticated
  USING (org_id = geosight_current_org_id());

DROP POLICY IF EXISTS "vault_mutate_admin" ON api_keys_vault;
CREATE POLICY "vault_mutate_admin" ON api_keys_vault
  FOR ALL TO authenticated
  USING (org_id = geosight_current_org_id() AND geosight_current_role() IN ('owner', 'admin'))
  WITH CHECK (org_id = geosight_current_org_id() AND geosight_current_role() IN ('owner', 'admin'));

-- ── brands / keywords: members+ can mutate, viewers read-only. ──────────────
DROP POLICY IF EXISTS "brands_select_own_org" ON brands;
CREATE POLICY "brands_select_own_org" ON brands
  FOR SELECT TO authenticated
  USING (org_id = geosight_current_org_id());

DROP POLICY IF EXISTS "brands_mutate_member_plus" ON brands;
CREATE POLICY "brands_mutate_member_plus" ON brands
  FOR ALL TO authenticated
  USING (
    org_id = geosight_current_org_id()
    AND geosight_current_role() IN ('owner', 'admin', 'member')
  )
  WITH CHECK (
    org_id = geosight_current_org_id()
    AND geosight_current_role() IN ('owner', 'admin', 'member')
  );

DROP POLICY IF EXISTS "keywords_select_own_org" ON keywords;
CREATE POLICY "keywords_select_own_org" ON keywords
  FOR SELECT TO authenticated
  USING (
    brand_id IN (SELECT id FROM brands WHERE org_id = geosight_current_org_id())
  );

DROP POLICY IF EXISTS "keywords_mutate_member_plus" ON keywords;
CREATE POLICY "keywords_mutate_member_plus" ON keywords
  FOR ALL TO authenticated
  USING (
    brand_id IN (SELECT id FROM brands WHERE org_id = geosight_current_org_id())
    AND geosight_current_role() IN ('owner', 'admin', 'member')
  )
  WITH CHECK (
    brand_id IN (SELECT id FROM brands WHERE org_id = geosight_current_org_id())
    AND geosight_current_role() IN ('owner', 'admin', 'member')
  );

-- ── scan_results / daily_metrics: read-only for everyone in the org. ────────
DROP POLICY IF EXISTS "scans_select_own_org" ON scan_results;
CREATE POLICY "scans_select_own_org" ON scan_results
  FOR SELECT TO authenticated
  USING (
    keyword_id IN (
      SELECT k.id FROM keywords k
      JOIN brands b ON b.id = k.brand_id
      WHERE b.org_id = geosight_current_org_id()
    )
  );

DROP POLICY IF EXISTS "metrics_select_own_org" ON daily_metrics;
CREATE POLICY "metrics_select_own_org" ON daily_metrics
  FOR SELECT TO authenticated
  USING (
    brand_id IN (SELECT id FROM brands WHERE org_id = geosight_current_org_id())
  );

-- ── audit_logs: each org sees its own audit trail. Inserts come from the
-- service role (api / workers) which bypasses RLS. ──────────────────────────
DROP POLICY IF EXISTS "audit_select_own_org" ON audit_logs;
CREATE POLICY "audit_select_own_org" ON audit_logs
  FOR SELECT TO authenticated
  USING (org_id = geosight_current_org_id());

-- ── waitlist_entries: public can insert their own row; reads are
-- service-role only (no policy for SELECT to authenticated). ────────────────
DROP POLICY IF EXISTS "waitlist_insert_anyone" ON waitlist_entries;
CREATE POLICY "waitlist_insert_anyone" ON waitlist_entries
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
