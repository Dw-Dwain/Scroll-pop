-- 0014_real_rls — Enforcing row-level security as a tenant-isolation backstop (C-1).
--
-- Validated against PG17 + TimescaleDB 2.17. Design (see MASTER §RLS):
--   • A dedicated NOBYPASSRLS role (`scrollpop_tenant`) is used by the API's TENANT connection pool.
--     The app's normal/superuser role keeps bypassing RLS by its role attribute (no GUC needed).
--   • Policies are TENANT-PREDICATE ONLY (no GUC bypass clause), so the tenant role cannot escape
--     isolation by setting a GUC. The per-request `app.current_tenant` GUC is set by the API on each
--     reserved tenant connection.
--
-- The API's ensure-rls.ts applies these same statements idempotently on boot (when DB_RLS_ENFORCED
-- and DB_TENANT_URL are set), so running this file by hand is optional — it's the durable record.
--
-- PREREQUISITE — create the tenant role once (NOT in this migration: a migration must not contain a
-- password). Run, substituting a strong password, then put the matching URL in DB_TENANT_URL:
--     CREATE ROLE scrollpop_tenant LOGIN PASSWORD '<strong-password>' NOBYPASSRLS;

DO $$
DECLARE
  t text;
  pred text;
BEGIN
  -- Only proceed if the tenant role exists; otherwise this is a no-op (boot self-heal handles it).
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scrollpop_tenant') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO scrollpop_tenant';

    FOREACH t IN ARRAY ARRAY[
      'sites','campaigns','designs','triggers','targeting_rules','frequency_rules',
      'events','leads','variants','clients','coupons','team_invites',
      'notifications','shopify_installations','tenant_members'
    ] LOOP
      pred := format('(%I.tenant_id = nullif(current_setting(''app.current_tenant'', true), '''')::uuid)', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO scrollpop_tenant', t);
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all_tenant_isolation', t);
      EXECUTE format('CREATE POLICY %I ON %I USING %s WITH CHECK %s', t || '_all_tenant_isolation', t, pred, pred);
    END LOOP;

    -- tenants keys on its own id.
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON tenants TO scrollpop_tenant';
    EXECUTE 'ALTER TABLE tenants ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE tenants FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tenants_self_isolation ON tenants';
    EXECUTE 'CREATE POLICY tenants_self_isolation ON tenants USING (id = nullif(current_setting(''app.current_tenant'', true), '''')::uuid) WITH CHECK (id = nullif(current_setting(''app.current_tenant'', true), '''')::uuid)';
  ELSE
    RAISE NOTICE 'Role scrollpop_tenant does not exist — skipping RLS. Create it then re-run (or let the API boot self-heal apply it).';
  END IF;
END $$;
