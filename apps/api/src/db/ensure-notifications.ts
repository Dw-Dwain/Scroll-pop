import { sqlClient } from './client.js';

/**
 * Ensure the notifications schema (migration 0006) exists. Runs on API boot,
 * idempotently, so a deploy that ships notification code never 500s on a prod DB
 * that hasn't had the migration applied by hand yet.
 *
 * This matters specifically because `notification_prefs` was added to the Drizzle
 * `tenants` schema — relational tenant queries (me, tenant-context) select all
 * columns, so a missing column would break tenant lookups platform-wide.
 *
 * All statements are additive + IF NOT EXISTS (safe to run on every boot, and a
 * no-op once the migration has been applied).
 */
export async function ensureNotificationsSchema(
  log: { info: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    await sqlClient.unsafe(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}';
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
      CREATE INDEX IF NOT EXISTS notifications_tenant_created_idx
        ON notifications (tenant_id, created_at DESC);
    `);
    log.info('[schema] notifications schema ensured');
  } catch (err) {
    log.error(err, '[schema] failed to ensure notifications schema (continuing startup)');
  }
}
