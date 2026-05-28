-- ScrollPop — Migration 0002 DOWN: Shopify OAuth + WordPress fields

DROP POLICY IF EXISTS shopify_installations_all_tenant_isolation ON shopify_installations;
DROP TABLE IF EXISTS shopify_installations;

ALTER TABLE sites
  DROP COLUMN IF EXISTS shopify_shop,
  DROP COLUMN IF EXISTS wp_site_url;
