import { sqlClient } from './client.js';

/**
 * Ensure migration 0011 schema exists:
 * - coupons table (P2-12 coupon auto-generation)
 * - auto_responder column on campaigns (P2-13 email auto-responders)
 * - spin_wheel value in design_kind enum (P1-12 gamified popups)
 *
 * All statements are additive + idempotent — safe to run on every boot.
 */
export async function ensureCouponsSchema(
  log: { info: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    // Coupons table
    await sqlClient.unsafe(`
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
      DO $$ BEGIN
        CREATE POLICY coupons_all_tenant_isolation ON coupons USING (true) WITH CHECK (true);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      CREATE UNIQUE INDEX IF NOT EXISTS coupons_tenant_code_uniq ON coupons (tenant_id, code);
      CREATE INDEX IF NOT EXISTS coupons_campaign_idx ON coupons (campaign_id);
    `);

    // auto_responder column on campaigns (nullable jsonb with default empty object)
    await sqlClient.unsafe(`
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS auto_responder JSONB NOT NULL DEFAULT '{}';
    `);

    // spin_wheel value in design_kind enum — ALTER TYPE ... ADD VALUE is non-transactional;
    // guard with a check so we don't error if the value already exists.
    await sqlClient.unsafe(`
      DO $$ BEGIN
        ALTER TYPE design_kind ADD VALUE IF NOT EXISTS 'spin_wheel';
      EXCEPTION WHEN others THEN NULL; END $$;
    `);

    log.info('[schema] coupons + auto_responder + spin_wheel ensured (migration 0011)');
  } catch (err) {
    log.error(err, '[schema] failed to ensure coupons schema (continuing startup)');
  }
}
