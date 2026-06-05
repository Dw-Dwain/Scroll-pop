-- DOWN: DROP TABLE IF EXISTS coupons; ALTER TABLE campaigns DROP COLUMN IF EXISTS auto_responder;
-- migration 0011: coupon codes (P2-12), email auto-responders (P2-13), spin_wheel enum (P1-12)

CREATE TABLE IF NOT EXISTS coupons (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL,
  campaign_id        UUID,
  code               TEXT NOT NULL,
  discount_pct       SMALLINT,
  discount_amt_cents INTEGER,
  max_uses           INTEGER,
  uses               INTEGER NOT NULL DEFAULT 0,
  expires_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY coupons_all_tenant_isolation ON coupons
  USING (true)
  WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS coupons_tenant_code_uniq ON coupons (tenant_id, code);
CREATE INDEX IF NOT EXISTS coupons_campaign_idx ON coupons (campaign_id);

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS auto_responder JSONB NOT NULL DEFAULT '{}';

DO $$ BEGIN
  ALTER TYPE design_kind ADD VALUE IF NOT EXISTS 'spin_wheel';
EXCEPTION WHEN others THEN NULL; END $$;
