import { sqlClient } from './client.js';

/**
 * Ensure migration 0012 schema exists:
 * - outbound_webhook column on campaigns (P2-14 Zapier / outbound webhooks)
 *
 * All statements are additive + idempotent — safe to run on every boot.
 */
export async function ensureWebhooksSchema(
  log: { info: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    await sqlClient.unsafe(`
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS outbound_webhook JSONB NOT NULL DEFAULT '{}';
    `);
    log.info('[schema] outbound_webhook column ensured (migration 0012)');
  } catch (err) {
    log.error(err, '[schema] failed to ensure outbound_webhook schema (continuing startup)');
  }
}
