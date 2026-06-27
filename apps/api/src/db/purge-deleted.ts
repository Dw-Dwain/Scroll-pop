import { sqlClient } from './client.js';

/**
 * Deleted-data lifecycle (24h download window, then purge).
 *
 * When a campaign or site is soft-deleted, its analytics events remain for a 24-hour
 * grace window during which the operator can still download them
 * (GET /api/v1/campaigns/:id/export). After 24 hours this job HARD-DELETES those events
 * so they stop appearing in analytics/dashboard and free storage.
 *
 * Scope of the hard delete: ONLY the `events` rows. The campaign/site config rows stay
 * soft-deleted (recoverable). This is the deliberate, user-approved exception to the
 * otherwise-strict "never hard delete tenant data" rule — and it's limited to analytics
 * events, not config.
 *
 * Runs in-process on the always-warm API (Render Standard): once shortly after boot, then
 * hourly. Kept in-process deliberately (CTO-AUDIT P2-9): a separate cron service would need
 * DATABASE_URL in another deployment (more secret surface), and moving this DESTRUCTIVE logic
 * into pg_cron SQL is harder to review. Instead it's hardened to never spike the API:
 *   - work is BOUNDED per statement (only N deleted entities per pass) so one giant locking
 *     DELETE can't happen; a backlog drains over subsequent hourly passes;
 *   - the campaign-scoped and site-scoped deletes are SEPARATE statements (smaller, each uses
 *     its own index) instead of one OR'd scan;
 *   - the start is JITTERED so multiple instances don't all fire at once;
 *   - the 30s statement_timeout on the pooled client (P2-11) is the final backstop.
 */

const PURGE_AFTER_HOURS = 24;
const INTERVAL_MS = 60 * 60 * 1000; // hourly
const BATCH_ENTITIES = 100;         // max deleted campaigns/sites processed per statement per pass

// H-4: lead-PII retention. Leads (email + name) are personal data and must not be kept forever
// (GDPR Art.5(1)(e) storage limitation / APPI). Default 13 months, matching the analytics/events
// retention. Override with LEAD_RETENTION_DAYS=0 to disable (e.g. if a tenant contract requires a
// different policy and you handle it elsewhere). Each sweep is BOUNDED like the events purge so it
// can never spike the DB; a backlog drains over subsequent hourly passes.
const LEAD_RETENTION_DAYS = (() => {
  const raw = Number(process.env['LEAD_RETENTION_DAYS']);
  return Number.isFinite(raw) && raw >= 0 ? raw : 395; // ~13 months
})();
const BATCH_LEADS = 5000;           // max lead rows deleted per statement per pass

type Log = { info: (msg: string) => void; error: (obj: unknown, msg: string) => void };

function rowsAffected(result: unknown): number {
  return (result as { count?: number })?.count ?? 0;
}

async function purgeOnce(log: Log): Promise<void> {
  try {
    // `events` is month-partitioned; DELETE on the parent cascades to all partitions.
    // Bound each delete to at most BATCH_ENTITIES soft-deleted entities so the statement
    // stays small and indexed; the hourly cadence drains any larger backlog over time.
    const byCampaign = await sqlClient.unsafe(
      `DELETE FROM events
       WHERE campaign_id IN (
         SELECT id FROM campaigns
         WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '${PURGE_AFTER_HOURS} hours'
         LIMIT ${BATCH_ENTITIES}
       )`,
    );
    const bySite = await sqlClient.unsafe(
      `DELETE FROM events
       WHERE site_id IN (
         SELECT id FROM sites
         WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '${PURGE_AFTER_HOURS} hours'
         LIMIT ${BATCH_ENTITIES}
       )`,
    );
    const count = rowsAffected(byCampaign) + rowsAffected(bySite);
    if (count > 0) log.info(`[purge] hard-deleted ${count} event(s) for campaigns/sites deleted >${PURGE_AFTER_HOURS}h ago`);

    // H-4: cascade lead PII when its parent campaign/site has been purged. The events purge above
    // only touched `events`; previously leads survived a campaign/site deletion forever. Mirror the
    // same bounded, soft-delete-grace-window logic for the `leads` table so erasing a campaign also
    // erases the personal data captured through it.
    const leadsByCampaign = await sqlClient.unsafe(
      `DELETE FROM leads
       WHERE campaign_id IN (
         SELECT id FROM campaigns
         WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '${PURGE_AFTER_HOURS} hours'
         LIMIT ${BATCH_ENTITIES}
       )`,
    );
    const leadsBySite = await sqlClient.unsafe(
      `DELETE FROM leads
       WHERE site_id IN (
         SELECT id FROM sites
         WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '${PURGE_AFTER_HOURS} hours'
         LIMIT ${BATCH_ENTITIES}
       )`,
    );
    const cascaded = rowsAffected(leadsByCampaign) + rowsAffected(leadsBySite);
    if (cascaded > 0) log.info(`[purge] hard-deleted ${cascaded} lead(s) for campaigns/sites deleted >${PURGE_AFTER_HOURS}h ago`);

    // H-4: retention sweep — delete leads older than the retention window regardless of campaign
    // state. Bounded to BATCH_LEADS ids per pass (uses the leads_tenant_created_idx on created_at).
    if (LEAD_RETENTION_DAYS > 0) {
      const expired = await sqlClient.unsafe(
        `DELETE FROM leads
         WHERE id IN (
           SELECT id FROM leads
           WHERE created_at < NOW() - INTERVAL '${LEAD_RETENTION_DAYS} days'
           LIMIT ${BATCH_LEADS}
         )`,
      );
      const purgedOld = rowsAffected(expired);
      if (purgedOld > 0) log.info(`[purge] hard-deleted ${purgedOld} lead(s) older than ${LEAD_RETENTION_DAYS}d (retention)`);
    }
  } catch (err) {
    // Best-effort — never crash the API over a purge failure (e.g., events table not
    // partitioned locally, transient DB error, statement_timeout). It retries next interval.
    log.error({ err }, '[purge] deleted-data purge pass failed');
  }
}

export function startDeletedDataPurge(log: Log): void {
  // Jittered first run (30–60s after boot) so multiple instances don't fire simultaneously.
  const firstDelay = 30_000 + Math.floor(Math.random() * 30_000);
  setTimeout(() => { void purgeOnce(log); }, firstDelay);
  const t = setInterval(() => { void purgeOnce(log); }, INTERVAL_MS);
  // Don't keep the process alive solely for this timer.
  (t as { unref?: () => void }).unref?.();
}
