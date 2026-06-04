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
      DO $$ BEGIN
        CREATE POLICY leads_all_tenant_isolation ON leads USING (true) WITH CHECK (true);
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
