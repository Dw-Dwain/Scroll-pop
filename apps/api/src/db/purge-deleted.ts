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
 * Runs in-process on the always-warm API (Render Standard): once ~30s after boot, then
 * hourly. No external scheduler/cron infrastructure required.
 */

const PURGE_AFTER_HOURS = 24;
const INTERVAL_MS = 60 * 60 * 1000; // hourly

type Log = { info: (msg: string) => void; error: (obj: unknown, msg: string) => void };

async function purgeOnce(log: Log): Promise<void> {
  try {
    // Delete events whose campaign OR site was soft-deleted more than 24h ago.
    // `events` is month-partitioned; DELETE on the parent cascades to all partitions.
    const result = await sqlClient.unsafe(
      `DELETE FROM events e
       WHERE e.campaign_id IN (
               SELECT id FROM campaigns
               WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '${PURGE_AFTER_HOURS} hours'
             )
          OR e.site_id IN (
               SELECT id FROM sites
               WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '${PURGE_AFTER_HOURS} hours'
             )`,
    );
    const count = (result as unknown as { count?: number })?.count ?? 0;
    if (count > 0) log.info(`[purge] hard-deleted ${count} event(s) for campaigns/sites deleted >${PURGE_AFTER_HOURS}h ago`);
  } catch (err) {
    // Best-effort — never crash the API over a purge failure (e.g., events table not
    // partitioned locally, transient DB error). It retries on the next interval.
    log.error({ err }, '[purge] deleted-data purge pass failed');
  }
}

export function startDeletedDataPurge(log: Log): void {
  setTimeout(() => { void purgeOnce(log); }, 30_000);
  const t = setInterval(() => { void purgeOnce(log); }, INTERVAL_MS);
  // Don't keep the process alive solely for this timer.
  (t as { unref?: () => void }).unref?.();
}
