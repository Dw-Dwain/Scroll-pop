-- Note: Postgres does not support removing values from an ENUM type easily.
-- The enum values 'geo', 'session_page_views', 'utm', 'ab_test' will remain.

ALTER TABLE "frequency_rules" DROP COLUMN IF EXISTS "interval_days";
