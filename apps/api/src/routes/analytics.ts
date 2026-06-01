import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/client.js';
import { events, campaigns } from '../db/schema.js';
import { eq, and, gte, isNull, sql } from 'drizzle-orm';

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/analytics/overview — tenant-level stats
  // Query param: ?days=7|30|90 (default 30)
  fastify.get<{ Querystring: { days?: string } }>('/analytics/overview', async (request, reply) => {
    const days = Math.min(Math.max(parseInt(request.query.days ?? '30', 10) || 30, 1), 90);
    const since = daysAgo(days);

    const rows = await db
      .select({
        eventType: events.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(events)
      .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since)))
      .groupBy(events.eventType);

    const counts = Object.fromEntries(rows.map((r) => [r.eventType, r.count]));
    const impressions = counts['impression'] ?? 0;
    const clicks = counts['click'] ?? 0;
    const ctr = impressions > 0 ? (clicks / impressions) : 0;

    // Debug: count events at multiple scopes to diagnose tenantId mismatch
    const [forTenant] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(eq(events.tenantId, request.tenantId));

    const [allEvents] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(events);

    // Sample of distinct tenantIds actually in the events table
    const tenantSample = await db
      .selectDistinct({ tenantId: events.tenantId })
      .from(events)
      .limit(5);

    return reply.send({
      data: {
        period: `${days}d`,
        impressions,
        views: counts['view'] ?? 0,
        clicks,
        dismissals: counts['dismiss'] ?? 0,
        conversions: counts['conversion'] ?? 0,
        ctr: parseFloat(ctr.toFixed(4)),
        _debug: {
          myTenantId:            request.tenantId,
          eventsForMyTenant:     forTenant?.count   ?? 0,
          totalEventsInDB:       allEvents?.count   ?? 0,
          tenantIdsInEventsTable: tenantSample.map(r => r.tenantId),
        },
      },
    });
  });

  // GET /api/v1/analytics/campaigns/:id — campaign-level daily breakdown
  fastify.get<{ Params: { id: string } }>(
    '/analytics/campaigns/:id',
    async (request, reply) => {
      const since = daysAgo(30);

      const rows = await db
        .select({
          day: sql<string>`date_trunc('day', ${events.ts})::date::text`,
          eventType: events.eventType,
          count: sql<number>`count(*)::int`,
        })
        .from(events)
        .where(
          and(
            eq(events.tenantId, request.tenantId),
            eq(events.campaignId, request.params.id),
            gte(events.ts, since)
          )
        )
        .groupBy(sql`date_trunc('day', ${events.ts})`, events.eventType)
        .orderBy(sql`date_trunc('day', ${events.ts})`);

      return reply.send({ data: rows });
    }
  );

  // GET /api/v1/analytics/campaigns — all tenant campaigns, aggregated stats
  // Query param: ?days=7|30|90 (default 30)
  fastify.get<{ Querystring: { days?: string } }>('/analytics/campaigns', async (request, reply) => {
    const days = Math.min(Math.max(parseInt(request.query.days ?? '30', 10) || 30, 1), 90);
    const since = daysAgo(days);

    const rows = await db
      .select({
        campaignId: events.campaignId,
        impressions: sql<number>`count(*) filter (where ${events.eventType}::text = 'impression')::int`,
        views: sql<number>`count(*) filter (where ${events.eventType}::text = 'view')::int`,
        clicks: sql<number>`count(*) filter (where ${events.eventType}::text = 'click')::int`,
        conversions: sql<number>`count(*) filter (where ${events.eventType}::text = 'conversion')::int`,
      })
      .from(events)
      .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since)))
      .groupBy(events.campaignId);

    const withCtr = rows.map((r) => ({
      campaignId: r.campaignId,
      impressions: r.impressions,
      views: r.views,
      clicks: r.clicks,
      conversions: r.conversions,
      ctr: r.impressions > 0 ? parseFloat((r.clicks / r.impressions).toFixed(4)) : 0,
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
        ctr: r.impressions > 0 ? parseFloat((r.clicks / r.impressions).toFixed(4)) : 0,
      }));

      return reply.send({ data: withCtr });
    }
  );

  // GET /api/v1/analytics/daily — per-day breakdown for last 60d (current + previous 30d windows)
  fastify.get('/analytics/daily', async (request, reply) => {
    const now = new Date();
    const since60 = new Date(now);
    since60.setDate(now.getDate() - 60);

    const rows = await db
      .select({
        day: sql<string>`date_trunc('day', ${events.ts})::date::text`,
        eventType: events.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(events)
      .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since60)))
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

    return reply.send({ data: { daily } });
  });

  // GET /api/v1/analytics/breakdown — device/country/referrer/trigger/unique breakdown
  // Query param: ?days=7|30|90 (default 30)
  fastify.get<{ Querystring: { days?: string } }>('/analytics/breakdown', async (request, reply) => {
    const days = Math.min(Math.max(parseInt(request.query.days ?? '30', 10) || 30, 1), 90);
    const since = daysAgo(days);

    const [deviceRows, countryRows, triggerRows, uniqueRow] = await Promise.all([
      // Device breakdown
      db.select({
        device: events.device,
        count: sql<number>`count(*)::int`,
      })
        .from(events)
        .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since), eq(events.eventType, 'impression')))
        .groupBy(events.device)
        .orderBy(sql`count(*) desc`),

      // Country breakdown (top 10)
      db.select({
        country: events.country,
        count: sql<number>`count(*)::int`,
      })
        .from(events)
        .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since), eq(events.eventType, 'impression')))
        .groupBy(events.country)
        .orderBy(sql`count(*) desc`)
        .limit(10),

      // Trigger type breakdown (from metadata)
      db.select({
        triggerType: sql<string>`metadata->>'triggerType'`,
        count: sql<number>`count(*)::int`,
      })
        .from(events)
        .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since), eq(events.eventType, 'impression')))
        .groupBy(sql`metadata->>'triggerType'`)
        .orderBy(sql`count(*) desc`),

      // Unique visitors
      db.select({ count: sql<number>`count(distinct visitor_id)::int` })
        .from(events)
        .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since))),
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
  // Query param: ?days=7|30|90 (default 30)
  fastify.get<{ Querystring: { days?: string } }>('/analytics/revenue', async (request, reply) => {
    const days = Math.min(Math.max(parseInt(request.query.days ?? '30', 10) || 30, 1), 90);
    const since = daysAgo(days);

    // Per-campaign revenue + funnel summary
    const rows = await db
      .select({
        campaignId:     events.campaignId,
        impressions:    sql<number>`count(*) filter (where ${events.eventType}::text = 'impression')::int`,
        clicks:         sql<number>`count(*) filter (where ${events.eventType}::text = 'click')::int`,
        emailCaptures:  sql<number>`count(*) filter (where ${events.eventType}::text = 'email_capture')::int`,
        checkouts:      sql<number>`count(*) filter (where ${events.eventType}::text = 'checkout_started')::int`,
        purchases:      sql<number>`count(*) filter (where ${events.eventType}::text = 'purchase_completed')::int`,
        revenueCents:   sql<number>`coalesce(sum(${events.revenueCents}) filter (where ${events.eventType}::text = 'purchase_completed'), 0)::int`,
      })
      .from(events)
      .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since)))
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
      ctr:              r.impressions > 0 ? +(r.clicks / r.impressions * 100).toFixed(2) : 0,
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
        period: `${days}d`,
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
  // Query param: ?days=7|30|90 (default 30), ?campaignId=uuid (optional)
  fastify.get<{ Querystring: { days?: string; campaignId?: string } }>('/analytics/funnel', async (request, reply) => {
    const days = Math.min(Math.max(parseInt(request.query.days ?? '30', 10) || 30, 1), 90);
    const since = daysAgo(days);
    const { campaignId } = request.query;

    const baseWhere = campaignId
      ? and(eq(events.tenantId, request.tenantId), gte(events.ts, since), eq(events.campaignId, campaignId))
      : and(eq(events.tenantId, request.tenantId), gte(events.ts, since));

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
        dismissals:   sql<number>`count(*) filter (where ${events.eventType}::text = 'dismiss')::int`,
        revenueCents: sql<number>`coalesce(sum(${events.revenueCents}) filter (where ${events.eventType}::text = 'purchase_completed'), 0)::int`,
      })
      .from(events)
      .where(baseWhere);

    const step = (n: number, of: number) => of > 0 ? +(n / of * 100).toFixed(1) : 0;
    const top = row?.impressions ?? 0;

    return reply.send({
      data: {
        period: `${days}d`,
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
          dismissals: row?.dismissals ?? 0,
          rageCloseRate: top > 0 ? +((row?.closes ?? 0) / top * 100).toFixed(1) : 0,
        },
        revenueCents: row?.revenueCents ?? 0,
        revenueDollars: +((row?.revenueCents ?? 0) / 100).toFixed(2),
      },
    });
  });

  // GET /api/v1/analytics/intelligence — Conversion Intelligence Engine
  // Returns best performers and actionable insights per dimension.
  // Query param: ?days=7|30|90 (default 30)
  fastify.get<{ Querystring: { days?: string } }>('/analytics/intelligence', async (request, reply) => {
    const days = Math.min(Math.max(parseInt(request.query.days ?? '30', 10) || 30, 1), 90);
    const since = daysAgo(days);
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
        period: `${days}d`,
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
