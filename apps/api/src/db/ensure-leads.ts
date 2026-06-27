import { sqlClient } from './client.js';

/**
 * Ensure the leads schema (migration 0009) exists. Runs on API boot, idempotently, so a
 * deploy that ships lead-capture code never fails on a prod DB that hasn't had the migration
 * applied yet. Mirrors ensureNotificationsSchema / ensureAuditLogSchema.
 *
 * All statements are additive + IF NOT EXISTS — safe to run on every boot. See CTO-AUDIT P0-3.
 */
export async function ensureLeadsSchema(
  log: { info: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    await sqlClient.unsafe(`
      CREATE TABLE IF NOT EXISTS leads (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID NOT NULL,
        site_id     UUID,
        campaign_id UUID,
        email       TEXT NOT NULL,
        name        TEXT,
        fields      JSONB NOT NULL DEFAULT '{}',
        visitor_id  TEXT,
        session_id  TEXT,
        source      TEXT,
        page_url    TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
      -- H-1b: the policy is a REAL tenant predicate, never the old permissive USING(true). Shipping a
      -- USING(true) placeholder meant that the day RLS enforcement is switched on, leads would still
      -- be world-readable across tenants until ensureRlsSchema() happened to re-run. The predicate
      -- below matches ensure-rls.ts exactly (current_setting('app.current_tenant')), so this table is
      -- correctly isolated the moment enforcement is enabled, regardless of ensure-* ordering. The
      -- system/superuser pool still bypasses RLS by role attribute (it is the owner and the table is
      -- not FORCE'd here — ensure-rls.ts adds FORCE + grants to the NOBYPASSRLS tenant role).
      DO $$ BEGIN
        CREATE POLICY leads_all_tenant_isolation ON leads
          USING (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid)
          WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      CREATE INDEX IF NOT EXISTS leads_tenant_created_idx ON leads (tenant_id, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS leads_tenant_campaign_email_uniq
        ON leads (tenant_id, campaign_id, email);
    `);
    log.info('[schema] leads schema ensured');
  } catch (err) {
    log.error(err, '[schema] failed to ensure leads schema (continuing startup)');
  }
}
