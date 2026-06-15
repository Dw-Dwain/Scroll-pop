import { sqlClient } from './client.js';

/**
 * Ensure the `sites.affiliate_links` column exists (per-site saved affiliate links).
 *
 * A site stores a JSONB array of `{ id, label, url, clickTracker? }` objects. They're managed
 * in Settings and surfaced in the campaign designer as a picker that pre-fills an element's
 * `href` (the X-close ad link / CTA / affiliate buttons). No new table — it's a single additive
 * column on the existing `sites` table (already RLS-protected), so this just runs the idempotent
 * ALTER. Additive + idempotent — safe on every boot.
 *
 * NOTE: like every ensure-* call this runs in the SCHEMA_VERSION-gated block in index.ts. Because
 * adding `affiliateLinks` to the Drizzle schema makes every `sites` SELECT include the column,
 * SCHEMA_VERSION MUST be bumped alongside this so a warm redeploy doesn't skip the ALTER and leave
 * every sites query 500ing on a missing column.
 */
export async function ensureAffiliateLinksSchema(
  log: { info: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    await sqlClient.unsafe(`
      ALTER TABLE sites ADD COLUMN IF NOT EXISTS affiliate_links JSONB NOT NULL DEFAULT '[]';
    `);
    log.info('[schema] sites.affiliate_links ensured (per-site affiliate links)');
  } catch (err) {
    log.error(err, '[schema] failed to ensure sites.affiliate_links (continuing startup)');
  }
}
