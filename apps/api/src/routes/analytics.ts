import type { FastifyPluginAsync } from 'fastify';
// systemDb (system pool): analytics is read-only aggregation and every query filters by
// request.tenantId at the app layer. Under RLS the per-request tenant pool hands out a single
// reserved connection, which can't run the Promise.all parallel queries these endpoints use
// (breakdown/intelligence) → 500. The system pool has many connections; tenant isolation is kept
// by the explicit tenantId filters. Same pattern as me.ts.
import { systemDb as db } from '../db/client.js';
import { events, campaigns } from '../db/schema.js';
import { eq, and, gte, isNull, sql } from 'drizzle-orm';

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const hoursAgo = (n: number) => { const d = new Date(); d.setHours(d.getHours() - n); return d; };

// Agency client scoping: restrict events to campaigns whose site belongs to the given client
// (events → campaign.site_id → site.client_id). Returns undefined when no client is active.
const clientEventFilter = (clientId: string | undefined, tenantId: string) =>
  clientId
    ? sql`${events.campaignId} IN (SELECT c.id FROM campaigns c JOIN sites s ON s.id = c.site_id WHERE s.client_id = ${clientId}::uuid AND c.tenant_id = ${tenantId}::uuid)`
    : undefined;

// Time-window parser shared by every aggregate endpoint. `?hours=1..48` selects an HOURLY rolling
// window (the 24-hour view); otherwise `?days=1..90` (default 30) selects a DAILY window. Centralising
// this is what makes the 24h option behave identically on every surface (Dashboard, Analytics, detail).
type Win = { since: Date; hourly: boolean; period: string };
const parseWindow = (q: { days?: string; hours?: string }): Win => {
  if (q.hours != null) {
    const hours = Math.min(Math.max(parseInt(q.hours, 10) || 24, 1), 48);
    return { since: hoursAgo(hours), hourly: true, period: `${hours}h` };
  }
  const days = Math.min(Math.max(parseInt(q.days ?? '30', 10) || 30, 1), 90);
  return { since: daysAgo(days), hourly: false, period: `${days}d` };
};

// UTC bucket-key expression for dense trend series — must match the JS keys denseBuckets() builds
// (hourly → 2026-06-18T14:00:00Z, daily → 2026-06-18). Truncating in UTC keeps keys deterministic
// regardless of DB session timezone.
const bucketKeyExpr = (hourly: boolean) =>
  hourly
    ? sql<string>`to_char(date_trunc('hour', ${events.ts} at time zone 'UTC'), 'YYYY-MM-DD"T"HH24:00:00"Z"')`
    : sql<string>`to_char(date_trunc('day', ${events.ts} at time zone 'UTC'), 'YYYY-MM-DD')`;

// Dense, zero-filled bucket keys from the start of the window's first hour/day → now (UTC), so a
// trend chart renders a continuous line even on quiet hours/days.
const denseBuckets = (since: Date, hourly: boolean): string[] => {
  const buckets: string[] = [];
  if (hourly) {
    const cur = new Date(since); cur.setUTCMinutes(0, 0, 0);
    const end = new Date();      end.setUTCMinutes(0, 0, 0);
    for (; cur <= end; cur.setUTCHours(cur.getUTCHours() + 1)) buckets.push(cur.toISOString().slice(0, 13) + ':00:00Z');
  } else {
    const cur = new Date(since); cur.setUTCHours(0, 0, 0, 0);
    const end = new Date();      end.setUTCHours(0, 0, 0, 0);
    for (; cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) buckets.push(cur.toISOString().slice(0, 10));
  }
  return buckets;
};

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/analytics/reset — permanently delete THIS tenant's analytics events (impressions,
  // clicks, conversions, etc.). Campaign configs, sites, and leads are untouched. Owner/admin only
  // (destructive, irreversible). Returns the number of event rows deleted.
  fastify.post('/analytics/reset', async (request, reply) => {
    if (request.memberRole !== 'owner' && request.memberRole !== 'admin') {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Only an owner or admin can reset analytics.' } });
    }
    const [c] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(events)
      .where(eq(events.tenantId, request.tenantId));
    await db.delete(events).where(eq(events.tenantId, request.tenantId));
    request.log.warn({ tenantId: request.tenantId, deleted: c?.n ?? 0 }, '[analytics] tenant reset — events deleted');
    return reply.send({ data: { deleted: c?.n ?? 0 } });
  });

  // GET /api/v1/analytics/overview — tenant-level stats
  // Query param: ?days=7|30|90 (default 30) OR ?hours=24 (last-24h view)
  fastify.get<{ Querystring: { days?: string; hours?: string; clientId?: string } }>('/analytics/overview', async (request, reply) => {
    const { since, period } = parseWindow(request.query);
    const clientFilter = clientEventFilter(request.query.clientId, request.tenantId);

    const rows = await db
      .select({
        eventType: events.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(events)
      .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since), clientFilter))
      .groupBy(events.eventType);

    const counts = Object.fromEntries(rows.map((r) => [r.eventType, r.count]));
    const impressions = counts['impression'] ?? 0;
    const clicks = counts['click'] ?? 0;
    // X-close affiliate redirects — tracked separately so they don't inflate clicks/CTR.
    const adCloseClicks = counts['close_ad_click'] ?? 0;

    // CTR on UNIQUE visitors (distinct clickers / distinct people who saw it). A clicker necessarily
    // saw the popup, so this is bounded ≤100%. Raw click EVENTS can exceed impressions — one popup
    // view produces several clicks (the CTA + the 2-step X-close affiliate click) — which made the
    // old clicks/impressions CTR read >100%.
    const [uniq] = await db
      .select({
        reach:    sql<number>`count(distinct ${events.visitorId}) filter (where ${events.eventType}::text = 'impression')::int`,
        clickers: sql<number>`count(distinct ${events.visitorId}) filter (where ${events.eventType}::text = 'click')::int`,
      })
      .from(events)
      .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since), clientFilter));
    const reach = uniq?.reach ?? 0;
    const ctr = reach > 0 ? Math.min((uniq?.clickers ?? 0) / reach, 1) : 0;

    return reply.send({
      data: {
        period,
        impressions,
        views: counts['view'] ?? 0,
        clicks,
        adCloseClicks,
        dismissals: counts['dismiss'] ?? 0,
        conversions: counts['conversion'] ?? 0,
        uniqueVisitors: reach,
        uniqueClicks: uniq?.clickers ?? 0, // distinct people who clicked (≤ uniqueVisitors)
        ctr: parseFloat(ctr.toFixed(4)),
      },
    });
  });

  // GET /api/v1/analytics/campaigns/:id — campaign-level time-series breakdown.
  // Daily buckets for ?days=7|30|90 (default 30); HOURLY buckets for ?hours=1..48 (the 24-hour
  // view on Campaign Detail). Returns a dense, zero-filled `series` in meta (every bucket present,
  // oldest→newest) so the trend chart renders a continuous line even on quiet days/hours, plus the
  // sparse grouped rows in `data` (the KPI tiles sum these) and the bounded unique-clicker CTR
  // (identical formula to /analytics/overview + /analytics/campaigns so every surface agrees).
  fastify.get<{ Params: { id: string }; Querystring: { days?: string; hours?: string } }>(
    '/analytics/campaigns/:id',
    async (request, reply) => {
      const hourly = request.query.hours != null;
      const hours = Math.min(Math.max(parseInt(request.query.hours ?? '24', 10) || 24, 1), 48);
      const days = Math.min(Math.max(parseInt(request.query.days ?? '30', 10) || 30, 1), 90);
      const since = hourly ? hoursAgo(hours) : daysAgo(days);
      const granularity: 'hour' | 'day' = hourly ? 'hour' : 'day';

      // Truncate in UTC so bucket keys are deterministic regardless of DB session timezone, and so
      // the client can zero-fill against the same keys. Hourly → ISO hour (…T14:00:00Z); daily → date.
      const bucketExpr = hourly
        ? sql<string>`to_char(date_trunc('hour', ${events.ts} at time zone 'UTC'), 'YYYY-MM-DD"T"HH24:00:00"Z"')`
        : sql<string>`to_char(date_trunc('day', ${events.ts} at time zone 'UTC'), 'YYYY-MM-DD')`;

      const where = and(
        eq(events.tenantId, request.tenantId),
        eq(events.campaignId, request.params.id),
        gte(events.ts, since)
      );

      const rows = await db
        .select({
          bucket: bucketExpr,
          eventType: events.eventType,
          count: sql<number>`count(*)::int`,
        })
        .from(events)
        .where(where)
        .groupBy(bucketExpr, events.eventType)
        .orderBy(bucketExpr);

      // Bounded unique-clicker CTR (distinct clickers ÷ distinct reach) over the SAME window —
      // identical to /analytics/overview + /analytics/campaigns so Campaign Detail shows the same
      // CTR as the Dashboard and Analytics pages. (Raw clicks÷impressions could exceed 100%.)
      const [uniq] = await db
        .select({
          reach:    sql<number>`count(distinct ${events.visitorId}) filter (where ${events.eventType}::text = 'impression')::int`,
          clickers: sql<number>`count(distinct ${events.visitorId}) filter (where ${events.eventType}::text = 'click')::int`,
        })
        .from(events)
        .where(where);
      const reach = uniq?.reach ?? 0;
      const ctr = reach > 0 ? Math.min((uniq?.clickers ?? 0) / reach, 1) : 0;

      // Dense, zero-filled buckets from the start of the window's first day/hour → now (in UTC).
      // Every grouped row lands in a bucket, so the chart's bars sum to the KPI totals.
      const byBucket: Record<string, Record<string, number>> = {};
      for (const r of rows) {
        (byBucket[r.bucket] ??= {})[r.eventType] = r.count;
      }
      const buckets: string[] = [];
      if (hourly) {
        const cur = new Date(since); cur.setUTCMinutes(0, 0, 0);
        const end = new Date();      end.setUTCMinutes(0, 0, 0);
        for (; cur <= end; cur.setUTCHours(cur.getUTCHours() + 1)) {
          buckets.push(cur.toISOString().slice(0, 13) + ':00:00Z');
        }
      } else {
        const cur = new Date(since); cur.setUTCHours(0, 0, 0, 0);
        const end = new Date();      end.setUTCHours(0, 0, 0, 0);
        for (; cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
          buckets.push(cur.toISOString().slice(0, 10));
        }
      }
      const series = buckets.map((b) => {
        const d = byBucket[b] ?? {};
        return {
          bucket: b,
          impressions:   d['impression']    ?? 0,
          views:         d['view']           ?? 0,
          clicks:        d['click']          ?? 0,
          conversions:   d['conversion']     ?? 0,
          adCloseClicks: d['close_ad_click'] ?? 0,
        };
      });

      return reply.send({
        data: rows,
        meta: {
          granularity,
          period: hourly ? `${hours}h` : `${days}d`,
          uniqueVisitors: reach,
          uniqueClicks: uniq?.clickers ?? 0,
          ctr: parseFloat(ctr.toFixed(4)),
          series,
        },
      });
    }
  );

  // GET /api/v1/analytics/campaigns — all tenant campaigns, aggregated stats
  // Query param: ?days=7|30|90 (default 30) OR ?hours=24 (last-24h view)
  fastify.get<{ Querystring: { days?: string; hours?: string; clientId?: string } }>('/analytics/campaigns', async (request, reply) => {
    const { since } = parseWindow(request.query);
    const clientFilter = clientEventFilter(request.query.clientId, request.tenantId);

    // Exclude soft-deleted campaigns so their lingering events (purged within 24h) don't show
    // up as orphaned "Campaign <id>" rows in the breakdown.
    const notDeleted = sql`${events.campaignId} NOT IN (SELECT id FROM campaigns WHERE tenant_id = ${request.tenantId}::uuid AND deleted_at IS NOT NULL)`;

    const rows = await db
      .select({
        campaignId: events.campaignId,
        impressions: sql<number>`count(*) filter (where ${events.eventType}::text = 'impression')::int`,
        views: sql<number>`count(*) filter (where ${events.eventType}::text = 'view')::int`,
        clicks: sql<number>`count(*) filter (where ${events.eventType}::text = 'click')::int`,
        adCloseClicks: sql<number>`count(*) filter (where ${events.eventType}::text = 'close_ad_click')::int`,
        conversions: sql<number>`count(*) filter (where ${events.eventType}::text = 'conversion')::int`,
        // Unique-visitor counts for a bounded CTR (see /analytics/overview for the why).
        reach: sql<number>`count(distinct ${events.visitorId}) filter (where ${events.eventType}::text = 'impression')::int`,
        clickers: sql<number>`count(distinct ${events.visitorId}) filter (where ${events.eventType}::text = 'click')::int`,
      })
      .from(events)
      .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since), notDeleted, clientFilter))
      .groupBy(events.campaignId);

    const withCtr = rows.map((r) => ({
      campaignId: r.campaignId,
      impressions: r.impressions,
      views: r.views,
      clicks: r.clicks,
      adCloseClicks: r.adCloseClicks,
      conversions: r.conversions,
      uniqueVisitors: r.reach,
      ctr: r.reach > 0 ? parseFloat(Math.min(r.clickers / r.reach, 1).toFixed(4)) : 0,
    }));

    return reply.send({ data: withCtr });
  });

  // GET /api/v1/analytics/sites/:id — site-level: campaigns ranked by CTR
  fastify.get<{ Params: { id: string } }>(
    '/analytics/sites/:id',
    async (request, reply) => {
      const since = daysAgo(30);

      const rows = await db
        .select({
          campaignId: events.campaignId,
          impressions: sql<number>`count(*) filter (where ${events.eventType}::text = 'impression')::int`,
          clicks: sql<number>`count(*) filter (where ${events.eventType}::text = 'click')::int`,
          // Unique-visitor counts for the bounded CTR used on every other surface (clickers ÷ reach).
          reach: sql<number>`count(distinct ${events.visitorId}) filter (where ${events.eventType}::text = 'impression')::int`,
          clickers: sql<number>`count(distinct ${events.visitorId}) filter (where ${events.eventType}::text = 'click')::int`,
        })
        .from(events)
        .where(
          and(
            eq(events.tenantId, request.tenantId),
            eq(events.siteId, request.params.id),
            gte(events.ts, since)
          )
        )
        .groupBy(events.campaignId)
        .orderBy(sql`count(*) filter (where ${events.eventType}::text = 'click') desc`);

      const withCtr = rows.map((r) => ({
        campaignId: r.campaignId,
        impressions: r.impressions,
        clicks: r.clicks,
        // Bounded unique-clicker CTR (distinct clickers ÷ distinct reach) — identical to
        // /analytics/overview + /analytics/campaigns so every surface shows the SAME CTR (was raw
        // clicks/impressions here, which read higher for multi-click campaigns).
        ctr: r.reach > 0 ? parseFloat(Math.min(r.clickers / r.reach, 1).toFixed(4)) : 0,
      }));

      return reply.send({ data: withCtr });
    }
  );

  // GET /api/v1/analytics/daily — trend data for the tenant-wide charts.
  //  • `daily`: fixed 60-day array (current + previous 30d) — drives the Dashboard deltas/sparklines.
  //  • `series` + `granularity`: a dense, zero-filled series for the SELECTED window, so the trend
  //    chart moves with the range picker — ?hours=24 → hourly buckets, ?days=7|30|90 → daily buckets.
  fastify.get<{ Querystring: { clientId?: string; days?: string; hours?: string } }>('/analytics/daily', async (request, reply) => {
    const now = new Date();
    const since60 = new Date(now);
    since60.setDate(now.getDate() - 60);
    const clientFilter = clientEventFilter(request.query.clientId, request.tenantId);

    const rows = await db
      .select({
        day: sql<string>`date_trunc('day', ${events.ts})::date::text`,
        eventType: events.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(events)
      .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since60), clientFilter))
      .groupBy(sql`date_trunc('day', ${events.ts})`, events.eventType)
      .orderBy(sql`date_trunc('day', ${events.ts})`);

    const byDay: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (!byDay[r.day]) byDay[r.day] = {};
      byDay[r.day]![r.eventType] = r.count;
    }

    const daily = Array.from({ length: 60 }, (_, i) => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - 59 + i);
      const key = d.toISOString().split('T')[0]!;
      const data = byDay[key] ?? {};
      return {
        day: key,
        impressions: data['impression'] ?? 0,
        views:       data['view']        ?? 0,
        clicks:      data['click']       ?? 0,
        conversions: data['conversion']  ?? 0,
      };
    });

    // Windowed dense series for the trend chart (respects ?hours / ?days). `day` carries the bucket
    // key (ISO hour for hourly, date for daily) so the existing chart components keep reading `.day`.
    const win = parseWindow(request.query);
    const bk = bucketKeyExpr(win.hourly);
    const seriesRows = await db
      .select({ bucket: bk, eventType: events.eventType, count: sql<number>`count(*)::int` })
      .from(events)
      .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, win.since), clientFilter))
      .groupBy(bk, events.eventType)
      .orderBy(bk);
    const byBucket: Record<string, Record<string, number>> = {};
    for (const r of seriesRows) (byBucket[r.bucket] ??= {})[r.eventType] = r.count;
    const series = denseBuckets(win.since, win.hourly).map((b) => {
      const d = byBucket[b] ?? {};
      return {
        day: b,
        impressions: d['impression'] ?? 0,
        views:       d['view']        ?? 0,
        clicks:      d['click']       ?? 0,
        conversions: d['conversion']  ?? 0,
      };
    });

    return reply.send({ data: { daily, series, granularity: win.hourly ? 'hour' : 'day' } });
  });

  // GET /api/v1/analytics/breakdown — device/country/referrer/trigger/unique breakdown
  // Query param: ?days=7|30|90 (default 30) OR ?hours=24 (last-24h view)
  fastify.get<{ Querystring: { days?: string; hours?: string; clientId?: string } }>('/analytics/breakdown', async (request, reply) => {
    const { since } = parseWindow(request.query);
    const clientFilter = clientEventFilter(request.query.clientId, request.tenantId);

    const [deviceRows, countryRows, triggerRows, uniqueRow] = await Promise.all([
      // Device breakdown
      db.select({
        device: events.device,
        count: sql<number>`count(*)::int`,
      })
        .from(events)
        .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since), eq(events.eventType, 'impression'), clientFilter))
        .groupBy(events.device)
        .orderBy(sql`count(*) desc`),

      // Country breakdown (top 10)
      db.select({
        country: events.country,
        count: sql<number>`count(*)::int`,
      })
        .from(events)
        .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since), eq(events.eventType, 'impression'), clientFilter))
        .groupBy(events.country)
        .orderBy(sql`count(*) desc`)
        .limit(10),

      // Trigger type breakdown (from metadata)
      db.select({
        triggerType: sql<string>`metadata->>'triggerType'`,
        count: sql<number>`count(*)::int`,
      })
        .from(events)
        .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since), eq(events.eventType, 'impression'), clientFilter))
        .groupBy(sql`metadata->>'triggerType'`)
        .orderBy(sql`count(*) desc`),

      // Unique visitors
      db.select({ count: sql<number>`count(distinct visitor_id)::int` })
        .from(events)
        .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since), clientFilter)),
    ]);

    return reply.send({
      data: {
        devices:        deviceRows.map(r => ({ device: r.device ?? 'unknown', count: r.count })),
        countries:      countryRows.map(r => ({ country: r.country ?? 'unknown', count: r.count })),
        triggerTypes:   triggerRows.filter(r => r.triggerType).map(r => ({ triggerType: r.triggerType!, count: r.count })),
        uniqueVisitors: uniqueRow[0]?.count ?? 0,
      },
    });
  });

  // GET /api/v1/analytics/recent — tenant-level recent events log
  fastify.get('/analytics/recent', async (request, reply) => {
    const recentEvents = await db
      .select({
        ts: events.ts,
        eventType: events.eventType,
        country: events.country,
        campaignId: events.campaignId,
      })
      .from(events)
      .where(eq(events.tenantId, request.tenantId))
      .orderBy(sql`${events.ts} desc`)
      .limit(10);

    return reply.send({ data: recentEvents });
  });

  // GET /api/v1/analytics/revenue — revenue dashboard per campaign
  // Query param: ?days=7|30|90 (default 30) OR ?hours=24 (last-24h view)
  fastify.get<{ Querystring: { days?: string; hours?: string; clientId?: string } }>('/analytics/revenue', async (request, reply) => {
    const { since, period } = parseWindow(request.query);
    const clientFilter = clientEventFilter(request.query.clientId, request.tenantId);

    // Per-campaign revenue + funnel summary
    const rows = await db
      .select({
        campaignId:     events.campaignId,
        impressions:    sql<number>`count(*) filter (where ${events.eventType}::text = 'impression')::int`,
        clicks:         sql<number>`count(*) filter (where ${events.eventType}::text = 'click')::int`,
        reach:          sql<number>`count(distinct ${events.visitorId}) filter (where ${events.eventType}::text = 'impression')::int`,
        clickers:       sql<number>`count(distinct ${events.visitorId}) filter (where ${events.eventType}::text = 'click')::int`,
        emailCaptures:  sql<number>`count(*) filter (where ${events.eventType}::text = 'email_capture')::int`,
        checkouts:      sql<number>`count(*) filter (where ${events.eventType}::text = 'checkout_started')::int`,
        purchases:      sql<number>`count(*) filter (where ${events.eventType}::text = 'purchase_completed')::int`,
        revenueCents:   sql<number>`coalesce(sum(${events.revenueCents}) filter (where ${events.eventType}::text = 'purchase_completed'), 0)::int`,
      })
      .from(events)
      .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since), clientFilter))
      .groupBy(events.campaignId);

    // Fetch campaign names for the enriched response
    const campaignIds = rows.map((r) => r.campaignId).filter(Boolean);
    const campaignNames: Record<string, string> = {};
    if (campaignIds.length > 0) {
      const names = await db
        .select({ id: campaigns.id, name: campaigns.name })
        .from(campaigns)
        .where(and(eq(campaigns.tenantId, request.tenantId), isNull(campaigns.deletedAt)));
      for (const c of names) campaignNames[c.id] = c.name;
    }

    const enriched = rows.map((r) => ({
      campaignId:       r.campaignId,
      campaignName:     campaignNames[r.campaignId] ?? 'Unknown',
      impressions:      r.impressions,
      clicks:           r.clicks,
      emailCaptures:    r.emailCaptures,
      checkouts:        r.checkouts,
      purchases:        r.purchases,
      revenueCents:     r.revenueCents,
      revenueDollars:   +(r.revenueCents / 100).toFixed(2),
      // Bounded unique-clicker CTR (clickers ÷ reach) ×100 — matches every other surface (was raw
      // clicks/impressions here, which read higher for multi-click campaigns). Kept on the 0–100 scale.
      ctr:              r.reach > 0 ? +(Math.min(r.clickers / r.reach, 1) * 100).toFixed(2) : 0,
      conversionRate:   r.impressions > 0 ? +(r.purchases / r.impressions * 100).toFixed(2) : 0,
      revenuePerPopup:  r.impressions > 0 ? +(r.revenueCents / r.impressions / 100).toFixed(4) : 0,
    })).sort((a, b) => b.revenueCents - a.revenueCents);

    const totals = enriched.reduce((acc, r) => ({
      revenueCents:   acc.revenueCents + r.revenueCents,
      purchases:      acc.purchases + r.purchases,
      impressions:    acc.impressions + r.impressions,
      emailCaptures:  acc.emailCaptures + r.emailCaptures,
    }), { revenueCents: 0, purchases: 0, impressions: 0, emailCaptures: 0 });

    return reply.send({
      data: {
        period,
        totals: {
          revenueDollars:      +(totals.revenueCents / 100).toFixed(2),
          purchases:           totals.purchases,
          emailCaptures:       totals.emailCaptures,
          revenuePerVisitor:   totals.impressions > 0 ? +(totals.revenueCents / totals.impressions / 100).toFixed(4) : 0,
        },
        campaigns: enriched,
      },
    });
  });

  // GET /api/v1/analytics/funnel — full conversion funnel step counts
  // Query param: ?days=7|30|90 (default 30) OR ?hours=24, plus ?campaignId=uuid (optional)
  fastify.get<{ Querystring: { days?: string; hours?: string; campaignId?: string; clientId?: string } }>('/analytics/funnel', async (request, reply) => {
    const { since, period } = parseWindow(request.query);
    const { campaignId, clientId } = request.query;
    const clientFilter = clientEventFilter(clientId, request.tenantId);

    // Exclude soft-deleted campaigns from the aggregate funnel so they stop reflecting in
    // analytics immediately (their raw events are also hard-purged 24h after deletion). A
    // campaignId-scoped query (drill-down / 24h download path) is exempt.
    const notDeleted = sql`${events.campaignId} NOT IN (SELECT id FROM campaigns WHERE tenant_id = ${request.tenantId}::uuid AND deleted_at IS NOT NULL)`;
    const baseWhere = campaignId
      ? and(eq(events.tenantId, request.tenantId), gte(events.ts, since), eq(events.campaignId, campaignId))
      : and(eq(events.tenantId, request.tenantId), gte(events.ts, since), notDeleted, clientFilter);

    const [row] = await db
      .select({
        triggered:    sql<number>`count(*) filter (where ${events.eventType}::text = 'trigger_fired')::int`,
        impressions:  sql<number>`count(*) filter (where ${events.eventType}::text = 'impression')::int`,
        views:        sql<number>`count(*) filter (where ${events.eventType}::text = 'view')::int`,
        clicks:       sql<number>`count(*) filter (where ${events.eventType}::text = 'click')::int`,
        submits:      sql<number>`count(*) filter (where ${events.eventType}::text = 'popup_submit')::int`,
        emailCapture: sql<number>`count(*) filter (where ${events.eventType}::text = 'email_capture')::int`,
        checkouts:    sql<number>`count(*) filter (where ${events.eventType}::text = 'checkout_started')::int`,
        purchases:    sql<number>`count(*) filter (where ${events.eventType}::text = 'purchase_completed')::int`,
        closes:       sql<number>`count(*) filter (where ${events.eventType}::text = 'popup_close')::int`,
        // Genuine "rage" closes: the X was hit within 3s of the popup showing (displayDuration is
        // ms-since-impression, beaconed by the snippet on every popup_close). A close after the
        // visitor actually read the offer is NOT rage, so it must not inflate this number.
        fastCloses:   sql<number>`count(*) filter (where ${events.eventType}::text = 'popup_close' and (${events.metadata} ->> 'displayDuration')::numeric < 3000)::int`,
        dismissals:   sql<number>`count(*) filter (where ${events.eventType}::text = 'dismiss')::int`,
        revenueCents: sql<number>`coalesce(sum(${events.revenueCents}) filter (where ${events.eventType}::text = 'purchase_completed'), 0)::int`,
      })
      .from(events)
      .where(baseWhere);

    const step = (n: number, of: number) => of > 0 ? +(n / of * 100).toFixed(1) : 0;
    const top = row?.impressions ?? 0;

    return reply.send({
      data: {
        period,
        steps: [
          { label: 'Trigger Fired',    count: row?.triggered    ?? 0, dropOffPct: 0 },
          { label: 'Popup Shown',      count: top,               dropOffPct: step(top,                      row?.triggered    ?? top) },
          { label: 'Popup Viewed',     count: row?.views        ?? 0, dropOffPct: step(row?.views ?? 0,     top) },
          { label: 'CTA Clicked',      count: row?.clicks       ?? 0, dropOffPct: step(row?.clicks ?? 0,    top) },
          { label: 'Form Submitted',   count: row?.submits      ?? 0, dropOffPct: step(row?.submits ?? 0,   top) },
          { label: 'Email Captured',   count: row?.emailCapture ?? 0, dropOffPct: step(row?.emailCapture ?? 0, top) },
          { label: 'Checkout Started', count: row?.checkouts    ?? 0, dropOffPct: step(row?.checkouts ?? 0, top) },
          { label: 'Purchase',         count: row?.purchases    ?? 0, dropOffPct: step(row?.purchases ?? 0, top) },
        ],
        exitStats: {
          closes:    row?.closes    ?? 0,
          fastCloses: row?.fastCloses ?? 0,
          dismissals: row?.dismissals ?? 0,
          // Rage = fast closes (<3s) as a share of popups shown — the true "I'm annoyed" signal,
          // not just "people eventually closed the popup" (which is normal and near-universal).
          rageCloseRate: top > 0 ? +((row?.fastCloses ?? 0) / top * 100).toFixed(1) : 0,
        },
        revenueCents: row?.revenueCents ?? 0,
        revenueDollars: +((row?.revenueCents ?? 0) / 100).toFixed(2),
      },
    });
  });

  // GET /api/v1/analytics/intelligence — Conversion Intelligence Engine
  // Returns best performers and actionable insights per dimension.
  // Query param: ?days=7|30|90 (default 30) OR ?hours=24 (last-24h view)
  fastify.get<{ Querystring: { days?: string; hours?: string } }>('/analytics/intelligence', async (request, reply) => {
    const { since, period } = parseWindow(request.query);
    const where = and(eq(events.tenantId, request.tenantId), gte(events.ts, since));

    const [trafficRows, triggerRows, deviceRows, revenueRow, campaignRows] = await Promise.all([
      // Best traffic source by CTR
      db.select({
        trafficSource: events.trafficSource,
        impressions:   sql<number>`count(*) filter (where ${events.eventType}::text = 'impression')::int`,
        clicks:        sql<number>`count(*) filter (where ${events.eventType}::text = 'click')::int`,
        purchases:     sql<number>`count(*) filter (where ${events.eventType}::text = 'purchase_completed')::int`,
        revenueCents:  sql<number>`coalesce(sum(${events.revenueCents}) filter (where ${events.eventType}::text = 'purchase_completed'), 0)::int`,
      })
        .from(events)
        .where(where)
        .groupBy(events.trafficSource)
        .orderBy(sql`count(*) filter (where ${events.eventType}::text = 'click') desc`)
        .limit(10),

      // Best trigger type by conversion rate (from metadata)
      db.select({
        triggerType:  sql<string>`metadata->>'triggerType'`,
        impressions:  sql<number>`count(*)::int`,
        scrollPct:    sql<number>`round(avg(${events.scrollDepthPct}))::int`,
      })
        .from(events)
        .where(and(where, sql`${events.eventType}::text = 'impression'`))
        .groupBy(sql`metadata->>'triggerType'`)
        .orderBy(sql`count(*) desc`)
        .limit(5),

      // Best device by revenue
      db.select({
        device:       events.device,
        impressions:  sql<number>`count(*) filter (where ${events.eventType}::text = 'impression')::int`,
        clicks:       sql<number>`count(*) filter (where ${events.eventType}::text = 'click')::int`,
        revenueCents: sql<number>`coalesce(sum(${events.revenueCents}) filter (where ${events.eventType}::text = 'purchase_completed'), 0)::int`,
      })
        .from(events)
        .where(where)
        .groupBy(events.device)
        .orderBy(sql`coalesce(sum(${events.revenueCents}) filter (where ${events.eventType}::text = 'purchase_completed'), 0) desc`)
        .limit(5),

      // Total revenue + overall conversion rate
      db.select({
        totalRevenueCents: sql<number>`coalesce(sum(${events.revenueCents}) filter (where ${events.eventType}::text = 'purchase_completed'), 0)::int`,
        totalImpressions:  sql<number>`count(*) filter (where ${events.eventType}::text = 'impression')::int`,
        totalPurchases:    sql<number>`count(*) filter (where ${events.eventType}::text = 'purchase_completed')::int`,
        totalEmails:       sql<number>`count(*) filter (where ${events.eventType}::text = 'email_capture')::int`,
      })
        .from(events)
        .where(where),

      // Best campaign by revenue
      db.select({
        campaignId:   events.campaignId,
        revenueCents: sql<number>`coalesce(sum(${events.revenueCents}) filter (where ${events.eventType}::text = 'purchase_completed'), 0)::int`,
        purchases:    sql<number>`count(*) filter (where ${events.eventType}::text = 'purchase_completed')::int`,
        impressions:  sql<number>`count(*) filter (where ${events.eventType}::text = 'impression')::int`,
        clicks:       sql<number>`count(*) filter (where ${events.eventType}::text = 'click')::int`,
      })
        .from(events)
        .where(where)
        .groupBy(events.campaignId)
        .orderBy(sql`coalesce(sum(${events.revenueCents}) filter (where ${events.eventType}::text = 'purchase_completed'), 0) desc`)
        .limit(1),
    ]);

    const summary = revenueRow[0];
    const bestCampaign = campaignRows[0];
    const bestTraffic = trafficRows[0];
    const bestTrigger = triggerRows.find((r) => r.triggerType);
    const bestDevice = deviceRows[0];

    // Fetch best campaign name
    let bestCampaignName = 'Unknown';
    if (bestCampaign?.campaignId) {
      const c = await db.query.campaigns.findFirst({
        where: and(eq(campaigns.id, bestCampaign.campaignId), isNull(campaigns.deletedAt)),
        columns: { name: true },
      });
      bestCampaignName = c?.name ?? 'Unknown';
    }

    return reply.send({
      data: {
        period,
        summary: {
          totalRevenueDollars: +((summary?.totalRevenueCents ?? 0) / 100).toFixed(2),
          totalPurchases:      summary?.totalPurchases   ?? 0,
          totalEmails:         summary?.totalEmails      ?? 0,
          overallConversionPct: summary?.totalImpressions
            ? +((summary.totalPurchases ?? 0) / summary.totalImpressions * 100).toFixed(2)
            : 0,
        },
        bestCampaign: bestCampaign ? {
          campaignId:    bestCampaign.campaignId,
          campaignName:  bestCampaignName,
          revenueDollars: +(bestCampaign.revenueCents / 100).toFixed(2),
          purchases:     bestCampaign.purchases,
          ctr:           bestCampaign.impressions > 0 ? +(bestCampaign.clicks / bestCampaign.impressions * 100).toFixed(1) : 0,
        } : null,
        bestTrafficSource: bestTraffic ? {
          source:        bestTraffic.trafficSource ?? 'direct',
          impressions:   bestTraffic.impressions,
          clicks:        bestTraffic.clicks,
          ctr:           bestTraffic.impressions > 0 ? +(bestTraffic.clicks / bestTraffic.impressions * 100).toFixed(1) : 0,
          revenueDollars: +(bestTraffic.revenueCents / 100).toFixed(2),
        } : null,
        bestTrigger: bestTrigger ? {
          triggerType:      bestTrigger.triggerType,
          impressions:      bestTrigger.impressions,
          avgScrollDepth:   bestTrigger.scrollPct ?? null,
        } : null,
        bestDevice: bestDevice ? {
          device:        bestDevice.device ?? 'unknown',
          impressions:   bestDevice.impressions,
          clicks:        bestDevice.clicks,
          revenueDollars: +(bestDevice.revenueCents / 100).toFixed(2),
        } : null,
        trafficSources: trafficRows.map((r) => ({
          source:        r.trafficSource ?? 'direct',
          impressions:   r.impressions,
          clicks:        r.clicks,
          ctr:           r.impressions > 0 ? +(r.clicks / r.impressions * 100).toFixed(1) : 0,
          revenueDollars: +(r.revenueCents / 100).toFixed(2),
        })),
      },
    });
  });
};
