-- Revert 0014_real_rls — drop FORCE RLS + tenant policies (back to permissive/no enforcement).
-- Leaves the scrollpop_tenant role and its grants in place (harmless; drop manually if desired:
--   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM scrollpop_tenant; DROP ROLE scrollpop_tenant;).

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sites','campaigns','designs','triggers','targeting_rules','frequency_rules',
    'events','leads','variants','clients','coupons','team_invites',
    'notifications','shopify_installations','tenant_members'
  ] LOOP
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all_tenant_isolation', t);
  END LOOP;

  EXECUTE 'ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE tenants DISABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenants_self_isolation ON tenants';
END $$;
