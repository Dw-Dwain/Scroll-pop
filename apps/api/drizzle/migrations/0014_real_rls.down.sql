-- Revert 0014_real_rls — restore the permissive policies and drop FORCE RLS.

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
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all_tenant_isolation', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (true) WITH CHECK (true)',
      t || '_all_tenant_isolation', t);
  END LOOP;
END $$;

ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_self_isolation ON tenants;
