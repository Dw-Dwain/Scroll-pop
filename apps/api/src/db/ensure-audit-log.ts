import { sqlClient } from './client.js';

/**
 * Ensure the admin audit-log schema (migration 0007) exists. Runs on API boot,
 * idempotently, so a deploy that ships audit-log code never fails on a prod DB that
 * hasn't had the migration applied yet. Mirrors ensureNotificationsSchema.
 *
 * The audit table records every super-admin action (plan change, tenant delete, sync)
 * so privileged operations are attributable after the fact (CTO-AUDIT Phase 4, Finding 8).
 * All statements are additive + IF NOT EXISTS — safe to run on every boot.
 */
export async function ensureAuditLogSchema(
  log: { info: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    await sqlClient.unsafe(`
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
    `);
    log.info('[schema] admin_audit_log schema ensured');
  } catch (err) {
    log.error(err, '[schema] failed to ensure admin_audit_log schema (continuing startup)');
  }
}
