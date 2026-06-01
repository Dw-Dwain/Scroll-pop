-- Revenue queries: filter purchase_completed events fast
CREATE INDEX IF NOT EXISTS events_purchase_idx
  ON events (tenant_id, ts DESC)
  WHERE event_type = 'purchase_completed';
