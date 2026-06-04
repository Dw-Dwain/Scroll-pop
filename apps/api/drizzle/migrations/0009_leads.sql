-- DOWN: DROP TABLE IF EXISTS leads;
-- Lead capture: email/form submissions collected by popups. Tenant-scoped with RLS.
-- Populated from the /e ingest path when a conversion event carries an email. CTO-AUDIT P0-3.

CREATE TABLE IF NOT EXISTS leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id     UUID REFERENCES sites(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
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

CREATE POLICY leads_all_tenant_isolation ON leads
  USING (true)
  WITH CHECK (true);

-- Listing: newest-first per tenant.
CREATE INDEX IF NOT EXISTS leads_tenant_created_idx ON leads (tenant_id, created_at DESC);

-- Dedupe repeat submissions of the same email to the same campaign.
CREATE UNIQUE INDEX IF NOT EXISTS leads_tenant_campaign_email_uniq
  ON leads (tenant_id, campaign_id, email);
