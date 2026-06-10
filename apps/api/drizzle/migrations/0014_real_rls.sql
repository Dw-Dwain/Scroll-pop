-- 0014_real_rls — Enforcing row-level security as a tenant-isolation backstop (C-1).
--
-- Replaces the legacy permissive `USING (true)` policies with real tenant predicates and turns on
-- FORCE ROW LEVEL SECURITY so even the table owner is constrained. After this migration the API
-- MUST run with DB_RLS_ENFORCED=true (which connects authenticated requests on a tenant pool that
-- sets `app.current_tenant`, and system paths on a pool that sets `app.bypass_rls=on`).
--
-- The ensure-rls.ts boot step applies the same statements idempotently, so applying this file is
-- optional if the app boots with DB_RLS_ENFORCED=true — but it's kept here as the durable record.
--
-- Each policy admits a row when the connection is a system/bypass connection OR the row's tenant
-- matches the request GUC. current_setting(name, true) returns NULL when unset → unscoped
-- connections match nothing (fail closed).

DO $$
DECLARE
  t text;
  pred text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sites','campaigns','designs','triggers','targeting_rules','frequency_rules',
    'events','leads','variants','clients','coupons','team_invites',
    'notifications','shopify_installations','tenant_members'
  ] LOOP
    pred := format(
      '(coalesce(current_setting(''app.bypass_rls'', true), '''') = ''on'' OR %I.tenant_id = nullif(current_setting(''app.current_tenant'', true), '''')::uuid)',
      t
    );
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all_tenant_isolation', t);
    EXECUTE format('CREATE POLICY %I ON %I USING %s WITH CHECK %s',
      t || '_all_tenant_isolation', t, pred, pred);
  END LOOP;
END $$;

-- tenants keys on its own id.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_self_isolation ON tenants;
CREATE POLICY tenants_self_isolation ON tenants
  USING (coalesce(current_setting('app.bypass_rls', true), '') = 'on'
         OR id = nullif(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (coalesce(current_setting('app.bypass_rls', true), '') = 'on'
         OR id = nullif(current_setting('app.current_tenant', true), '')::uuid);
