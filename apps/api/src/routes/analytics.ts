import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/client.js';
import { events } from '../db/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';

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
        impressions: sql<number>`count(*) filter (where ${events.eventType} = 'impression')::int`,
        views: sql<number>`count(*) filter (where ${events.eventType} = 'view')::int`,
        clicks: sql<number>`count(*) filter (where ${events.eventType} = 'click')::int`,
        conversions: sql<number>`count(*) filter (where ${events.eventType} = 'conversion')::int`,
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
          impressions: sql<number>`count(*) filter (where ${events.eventType} = 'impression')::int`,
          clicks: sql<number>`count(*) filter (where ${events.eventType} = 'click')::int`,
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
        .orderBy(sql`count(*) filter (where ${events.eventType} = 'click') desc`);

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
};
