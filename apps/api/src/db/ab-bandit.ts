import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import { systemDb, sqlClient } from './client.js';
import { campaigns, variants, events, sites } from './schema.js';
import { thompsonWeights, type BanditArm } from '../lib/bandit.js';
import { purgeSiteConfigCache } from '../lib/cache-purge.js';

/**
 * A/B Thompson-sampling bandit scheduler (business logic stays in the API per the architecture rules).
 *
 * For each campaign that an operator has explicitly opted into bandit mode (`ab_config.mode = 'bandit'`,
 * status not 'paused'), it models each variant's success rate as Beta(successes+1, failures+1), draws
 * Thompson samples, and rewrites `variants.weight` ∝ P(best). Then it purges the edge config cache so
 * the new split serves within the minute. The snippet is untouched — it already does weighted sticky
 * allocation; the bandit only feeds it better weights.
 *
 * SAFETY (production is live, ads are serving):
 *   • OPT-IN ONLY. `ab_config` defaults to '{}' on every existing campaign ⇒ mode≠'bandit' ⇒ this job
 *     never touches a live campaign until someone turns it on. New manual A/B tests are unaffected too.
 *   • ADVISORY LOCK. Mirrors the boot-migrate lock so only ONE of the N machines rebalances per cycle.
 *   • BOUNDED. ≤ MAX_CAMPAIGNS_PER_PASS per pass; the aggregation is windowed to WINDOW_DAYS so the
 *     scan over the (partitioned) events hypertable stays cheap and recency-weighted.
 *   • NON-DESTRUCTIVE. Keeps a MIN_ARM_WEIGHT floor so no arm is starved to 0 (the config builder
 *     drops weight-0 variants from serving, which would strand sticky visitors and halt their data).
 *   • WRITE-ON-CHANGE. Skips the DB write + cache purge entirely when weights are unchanged or the
 *     sample is too thin (< MIN_TOTAL_REACH), so it can't churn the live edge cache on noise.
 *   • KILL SWITCH. `AB_BANDIT_ENABLED=false` disables the whole loop.
 *   • TENANT ISOLATION. Runs on the system pool (like the migrate/purge jobs) but every query is
 *     explicitly scoped to the campaign's own tenant_id + campaign_id, so a variant's weight is only
 *     ever derived from that same tenant's events. RLS on the request path is unaffected.
 */

type Log = { info: (msg: string) => void; error: (obj: unknown, msg: string) => void };

const BANDIT_LOCK = 472702; // distinct from the boot-migrate lock (472701)
const DEFAULT_INTERVAL_MIN = 150; // ~2.5h (task: every ~2–3h)
const MAX_CAMPAIGNS_PER_PASS = 50;
const MIN_ARM_WEIGHT = 1; // keep every arm served (>0) so sticky visitors aren't stranded
const MIN_TOTAL_REACH = 50; // don't rebalance on statistical noise before this much unique reach
const WINDOW_DAYS = 30; // recency window for the posterior (also bounds the events scan)
const DRAWS = 2000; // Monte-Carlo draws for the P(best) estimate

function intervalMs(): number {
  const env = parseInt(process.env['AB_BANDIT_INTERVAL_MIN'] ?? '', 10);
  const min = Number.isFinite(env) && env >= 15 ? env : DEFAULT_INTERVAL_MIN;
  return min * 60 * 1000;
}

interface OptInCampaign {
  id: string;
  tenantId: string;
  siteId: string;
  objective: 'ctr' | 'conversion';
}

async function loadOptInCampaigns(): Promise<OptInCampaign[]> {
  const rows = await systemDb
    .select({
      id: campaigns.id,
      tenantId: campaigns.tenantId,
      siteId: campaigns.siteId,
      objective: sql<string>`coalesce(${campaigns.abConfig}->>'objective', 'ctr')`,
    })
    .from(campaigns)
    .where(
      and(
        sql`${campaigns.abConfig}->>'mode' = 'bandit'`,
        sql`coalesce(${campaigns.abConfig}->>'status', 'running') <> 'paused'`,
        sql`${campaigns.deletedAt} is null`,
      ),
    )
    .limit(MAX_CAMPAIGNS_PER_PASS);
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    siteId: r.siteId,
    objective: r.objective === 'conversion' ? 'conversion' : 'ctr',
  }));
}

async function rebalanceCampaign(c: OptInCampaign, log: Log): Promise<boolean> {
  // Stable order (createdAt) so arms line up with weights deterministically.
  const defs = await systemDb
    .select({ id: variants.id, weight: variants.weight })
    .from(variants)
    .where(and(eq(variants.tenantId, c.tenantId), eq(variants.campaignId, c.id)))
    .orderBy(asc(variants.createdAt));
  if (defs.length < 2) return false; // nothing to balance

  // Bounded, unique-visitor counts (same standardized counting as analytics.ts), within the window.
  const agg = await systemDb
    .select({
      variantId: events.abVariantId,
      reach: sql<number>`count(distinct ${events.visitorId}) filter (where ${events.eventType}::text = 'impression')::int`,
      clickers: sql<number>`count(distinct ${events.visitorId}) filter (where ${events.eventType}::text = 'click')::int`,
      converters: sql<number>`count(distinct ${events.visitorId}) filter (where ${events.eventType}::text = 'conversion')::int`,
    })
    .from(events)
    .where(
      and(
        eq(events.tenantId, c.tenantId),
        eq(events.campaignId, c.id),
        isNotNull(events.abVariantId),
        sql`${events.ts} >= now() - (${WINDOW_DAYS} * interval '1 day')`,
      ),
    )
    .groupBy(events.abVariantId);

  const byId = new Map(agg.map((r) => [r.variantId as string, r]));
  const arms: BanditArm[] = defs.map((d) => {
    const a = byId.get(d.id);
    const trials = a?.reach ?? 0;
    const successes = c.objective === 'conversion' ? a?.converters ?? 0 : a?.clickers ?? 0;
    return { successes, trials };
  });

  const totalReach = arms.reduce((s, a) => s + a.trials, 0);
  if (totalReach < MIN_TOTAL_REACH) return false; // too little data — leave weights as set

  const weights = thompsonWeights(arms, { draws: DRAWS, minWeight: MIN_ARM_WEIGHT, total: 100 });
  // Only write (and purge the edge) when weights actually change.
  if (!weights.some((w, i) => w !== defs[i]!.weight)) return false;

  for (let i = 0; i < defs.length; i++) {
    await systemDb
      .update(variants)
      .set({ weight: weights[i]!, updatedAt: new Date() })
      .where(and(eq(variants.id, defs[i]!.id), eq(variants.tenantId, c.tenantId)));
  }

  // Stamp lastBalancedAt (observability — the dashboard can show "auto-optimized …").
  const patch = JSON.stringify({ lastBalancedAt: new Date().toISOString() });
  await systemDb
    .update(campaigns)
    .set({ abConfig: sql`${campaigns.abConfig} || ${patch}::jsonb`, updatedAt: new Date() })
    .where(and(eq(campaigns.id, c.id), eq(campaigns.tenantId, c.tenantId)));

  const site = await systemDb
    .select({ publicKey: sites.publicKey })
    .from(sites)
    .where(eq(sites.id, c.siteId))
    .limit(1);
  if (site[0]?.publicKey) await purgeSiteConfigCache(site[0].publicKey);

  log.info(`[bandit] campaign ${c.id} (${c.objective}) reweighted → ${weights.join('/')}`);
  return true;
}

async function runOnce(log: Log): Promise<void> {
  if (process.env['AB_BANDIT_ENABLED'] === 'false') return; // hard kill switch
  let lockConn: Awaited<ReturnType<typeof sqlClient.reserve>> | null = null;
  try {
    lockConn = await sqlClient.reserve();
    const rows = await lockConn`SELECT pg_try_advisory_lock(${BANDIT_LOCK}) AS locked`;
    if (!rows[0]?.['locked']) return; // another machine holds the lock this cycle — skip
    const optIn = await loadOptInCampaigns();
    let n = 0;
    for (const c of optIn) {
      try {
        if (await rebalanceCampaign(c, log)) n += 1;
      } catch (err) {
        log.error({ err, campaignId: c.id }, '[bandit] campaign rebalance failed (continuing)');
      }
    }
    if (n > 0) log.info(`[bandit] rebalanced ${n} campaign(s) this pass`);
  } catch (err) {
    log.error({ err }, '[bandit] pass failed');
  } finally {
    if (lockConn) {
      try {
        await lockConn`SELECT pg_advisory_unlock(${BANDIT_LOCK})`;
      } catch {
        /* ignore */
      }
      try {
        lockConn.release();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Start the in-process bandit loop. Jittered first run so multiple machines don't fire together,
 * then every ~2.5h (AB_BANDIT_INTERVAL_MIN to override). unref() so it never keeps the process alive.
 */
export function startAbBandit(log: Log): void {
  const firstDelay = 60_000 + Math.floor(Math.random() * 60_000); // 1–2 min after boot
  setTimeout(() => {
    void runOnce(log);
  }, firstDelay);
  const t = setInterval(() => {
    void runOnce(log);
  }, intervalMs());
  (t as { unref?: () => void }).unref?.();
}
