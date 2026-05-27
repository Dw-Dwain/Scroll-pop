import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/client.js';
import { events } from '../db/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';

const THIRTY_DAYS_AGO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
};

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/analytics/overview — tenant-level: total impressions, clicks, CTR (30d)
  fastify.get('/analytics/overview', async (request, reply) => {
    const since = THIRTY_DAYS_AGO();

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

    return reply.send({
      data: {
        period: '30d',
        impressions,
        views: counts['view'] ?? 0,
        clicks,
        dismissals: counts['dismiss'] ?? 0,
        conversions: counts['conversion'] ?? 0,
        ctr: parseFloat(ctr.toFixed(4)),
      },
    });
  });

  // GET /api/v1/analytics/campaigns/:id — campaign-level daily breakdown
  fastify.get<{ Params: { id: string } }>(
    '/analytics/campaigns/:id',
    async (request, reply) => {
      const since = THIRTY_DAYS_AGO();

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

  // GET /api/v1/analytics/campaigns — all tenant campaigns, aggregated stats (30d batch)
  fastify.get('/analytics/campaigns', async (request, reply) => {
    const since = THIRTY_DAYS_AGO();

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
      const since = THIRTY_DAYS_AGO();

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
      d.setDate(now.getDate() - 59 + i);
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
