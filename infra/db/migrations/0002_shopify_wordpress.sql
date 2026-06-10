-- ============================================================
-- Migration: 0002_shopify_wordpress
-- Description: Shopify OAuth installations + WordPress site fields
-- ============================================================

-- ── UP ───────────────────────────────────────────────────────────────────────

-- Add Shopify and WordPress columns to sites table
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS shopify_shop     TEXT,
  ADD COLUMN IF NOT EXISTS wp_site_url      TEXT;

-- Shopify Installations table
CREATE TABLE IF NOT EXISTS shopify_installations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id           UUID        REFERENCES sites(id) ON DELETE SET NULL,
  shop              TEXT        NOT NULL UNIQUE,
  access_token      TEXT        NOT NULL,
  scope             TEXT,
  script_tag_id     TEXT,
  nonce             TEXT,
  installed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uninstalled_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shopify_installations_tenant_idx ON shopify_installations(tenant_id);
CREATE INDEX IF NOT EXISTS shopify_installations_shop_idx   ON shopify_installations(shop);
CREATE INDEX IF NOT EXISTS shopify_installations_site_idx   ON shopify_installations(site_id);

-- Row-level security (naming convention: {table}_{action}_tenant_isolation)
ALTER TABLE shopify_installations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shopify_installations_all_tenant_isolation ON shopify_installations;
CREATE POLICY shopify_installations_all_tenant_isolation
  ON shopify_installations
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── DOWN (reversible) ────────────────────────────────────────────────────────
-- To roll back, run the following:
--
--   DROP POLICY IF EXISTS shopify_installations_all_tenant_isolation ON shopify_installations;
--   DROP TABLE IF EXISTS shopify_installations;
--   ALTER TABLE sites DROP COLUMN IF EXISTS shopify_shop;
--   ALTER TABLE sites DROP COLUMN IF EXISTS wp_site_url;
