-- ScrollPop — Migration 0003: Analytics expansion
-- Adds richer event types + revenue attribution columns to the events table.
-- Reversible: see 0003_analytics_expansion.down.sql

-- ─── New event types ──────────────────────────────────────────────────────────
-- Postgres only allows adding (not removing) enum values. Removal requires
-- full enum replacement — handled in the down migration if needed.

ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'popup_close';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'popup_submit';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'popup_expand';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'popup_minimize';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'email_capture';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'sms_capture';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'discount_redeemed';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'checkout_started';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'purchase_completed';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'trigger_fired';

-- ─── New columns on events ────────────────────────────────────────────────────

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS scroll_depth_pct  SMALLINT,
  ADD COLUMN IF NOT EXISTS traffic_source    TEXT,
  ADD COLUMN IF NOT EXISTS ab_variant_id     TEXT,
  ADD COLUMN IF NOT EXISTS shopify_order_id  TEXT,
  ADD COLUMN IF NOT EXISTS revenue_cents     INTEGER;

-- ─── Indexes for new query patterns ──────────────────────────────────────────

-- Revenue queries: filter purchase_completed events fast
-- (Moved to a separate migration or manual run due to Postgres enum rules)
-- CREATE INDEX IF NOT EXISTS events_purchase_idx
--   ON events (tenant_id, ts DESC)
--   WHERE event_type = 'purchase_completed';

-- Traffic source breakdown queries
CREATE INDEX IF NOT EXISTS events_traffic_source_idx
  ON events (tenant_id, traffic_source, event_type);

-- Funnel queries: all event types for a tenant in a time range
CREATE INDEX IF NOT EXISTS events_funnel_idx
  ON events (tenant_id, event_type, ts DESC);
