-- DOWN: DROP TABLE IF EXISTS admin_audit_log;
-- Admin audit log — records every super-admin action (plan change, tenant delete, sync)
-- so privileged operations are attributable. See CTO-AUDIT Phase 4, Finding 8.

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id    UUID,
  actor_email      TEXT,
  action           TEXT NOT NULL,
  target_tenant_id UUID,
  details          JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
  ON admin_audit_log (created_at DESC);
