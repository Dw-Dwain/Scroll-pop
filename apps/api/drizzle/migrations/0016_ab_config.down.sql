-- Down migration 0016: drop the per-campaign A/B experiment settings column.
-- Reversible down-migration for an additive column.
ALTER TABLE campaigns
  DROP COLUMN IF EXISTS ab_config; -- REVIEWED: intentional, reversible down-migration
