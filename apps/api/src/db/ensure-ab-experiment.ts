import { sqlClient } from './client.js';

/**
 * Ensure the per-campaign A/B experiment settings column (migration 0016) exists. Runs on API
 * boot, idempotently, so a deploy that ships the Thompson-sampling bandit never fails on a prod DB
 * that hasn't had the migration applied yet. Mirrors ensureWebhooksSchema / ensureIntegrationsSchema
 * (both ADD COLUMN-on-campaigns ensures).
 *
 * The column defaults to '{}' for every existing campaign, which the bandit reads as mode='manual'
 * — so no live campaign is ever auto-rebalanced until an operator opts in. Additive + safe on a
 * live table: ADD COLUMN with a constant default is a metadata-only change in Postgres 11+.
 */
export async function ensureAbExperimentSchema(
  log: { info: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    await sqlClient.unsafe(`
      ALTER TABLE campaigns
        ADD COLUMN IF NOT EXISTS ab_config JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);
    log.info('[schema] campaigns.ab_config ensured');
  } catch (err) {
    log.error(err, '[schema] failed to ensure campaigns.ab_config (continuing startup)');
  }
}
