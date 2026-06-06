import { sqlClient } from './client.js';

/**
 * Ensure migration 0013 schema exists:
 * - integrations column on tenants  (P1-8 Klaviyo, P1-9 Mailchimp)
 * - esp_config column on campaigns  (per-campaign ESP opt-in)
 *
 * All statements are additive + idempotent — safe to run on every boot.
 */
export async function ensureIntegrationsSchema(
  log: { info: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    await sqlClient.unsafe(`
      ALTER TABLE tenants   ADD COLUMN IF NOT EXISTS integrations JSONB NOT NULL DEFAULT '{}';
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS esp_config   JSONB NOT NULL DEFAULT '{}';
    `);
    log.info('[schema] integrations + esp_config columns ensured (migration 0013)');
  } catch (err) {
    log.error(err, '[schema] failed to ensure integrations schema (continuing startup)');
  }
}
