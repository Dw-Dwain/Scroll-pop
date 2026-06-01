-- ScrollPop — Migration 0003 DOWN: Revert analytics expansion
-- NOTE: Postgres cannot remove enum values once added. The enum values
-- (popup_close, email_capture, etc.) will remain in the type definition
-- but will no longer be used by the application after this rollback.
-- To fully remove them, recreate the enum — only safe on an empty events table.

-- ─── Drop new indexes ─────────────────────────────────────────────────────────
DROP INDEX IF EXISTS events_purchase_idx;
DROP INDEX IF EXISTS events_traffic_source_idx;
DROP INDEX IF EXISTS events_funnel_idx;

-- ─── Remove new columns ───────────────────────────────────────────────────────
ALTER TABLE events
  DROP COLUMN IF EXISTS scroll_depth_pct,
  DROP COLUMN IF EXISTS traffic_source,
  DROP COLUMN IF EXISTS ab_variant_id,
  DROP COLUMN IF EXISTS shopify_order_id,
  DROP COLUMN IF EXISTS revenue_cents;
