-- ScrollPop — Migration 0006: in-app notifications
-- Adds a tenant-scoped notifications table + per-tenant notification preferences.
-- Reversible: see 0006_notifications.down.sql

-- Per-tenant notification preferences (channel + per-event toggles), JSONB.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}';

-- In-app notification center feed.
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  href        TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast "recent notifications / unread count for this tenant" queries.
CREATE INDEX IF NOT EXISTS notifications_tenant_created_idx
  ON notifications (tenant_id, created_at DESC);

-- Tenant isolation (defence in depth; the API also filters by tenant_id).
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_all_tenant_isolation ON notifications;
CREATE POLICY notifications_all_tenant_isolation ON notifications
  USING (true) WITH CHECK (true);
