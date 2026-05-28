-- ScrollPop — Migration 0002: Shopify OAuth + WordPress fields
-- Reversible: see 0002_shopify_wordpress.down.sql

-- ─── Add Shopify and WordPress columns to sites ───────────────────────────────

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS shopify_shop  TEXT,
  ADD COLUMN IF NOT EXISTS wp_site_url   TEXT;

-- ─── Shopify Installations ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shopify_installations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id          UUID        REFERENCES sites(id) ON DELETE SET NULL,
  shop             TEXT        NOT NULL UNIQUE,
  access_token     TEXT        NOT NULL,
  scope            TEXT,
  script_tag_id    TEXT,
  nonce            TEXT,
  installed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uninstalled_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shopify_installations_tenant_idx ON shopify_installations(tenant_id);
CREATE INDEX IF NOT EXISTS shopify_installations_shop_idx   ON shopify_installations(shop);
CREATE INDEX IF NOT EXISTS shopify_installations_site_idx   ON shopify_installations(site_id);

ALTER TABLE shopify_installations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shopify_installations_all_tenant_isolation ON shopify_installations;
CREATE POLICY shopify_installations_all_tenant_isolation
  ON shopify_installations
  USING (true)
  WITH CHECK (true);
