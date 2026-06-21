-- Migration 0016: per-campaign A/B experiment settings (Thompson-sampling bandit).
-- Additive + safe on a live table — a constant DEFAULT makes this metadata-only in Postgres 11+.
-- Applied on boot by ensureAbExperimentSchema() (the journal is intentionally not advanced; the
-- ensure-* self-heal is this repo's schema mechanism for warm additive columns).
--
-- ab_config shape: { mode: 'manual'|'bandit', objective: 'ctr'|'conversion',
--                    status: 'running'|'paused', lastBalancedAt?: ISO8601 }
-- Default '{}' ⇒ mode treated as 'manual' ⇒ the bandit never touches existing campaigns.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS ab_config JSONB NOT NULL DEFAULT '{}'::jsonb;
