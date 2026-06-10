import type { FastifyPluginAsync } from 'fastify';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { campaigns, events } from '../db/schema.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const since30d = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
};

const since15m = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - 15);
  return d;
};

export const opsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ops/overview', async (request, reply) => {
    const [activeCampaignsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaigns)
      .where(and(eq(campaigns.tenantId, request.tenantId), eq(campaigns.status, 'active')));

    const [conversionVelocity15mRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(
        and(
          eq(events.tenantId, request.tenantId),
          eq(events.eventType, 'conversion'),
          gte(events.ts, since15m())
        )
      );

    const [recentVisitorsRow] = await db
      .select({ count: sql<number>`count(distinct ${events.visitorId})::int` })
      .from(events)
      .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since15m())));

    return reply.send({
      data: {
        activeVisitorsNow: recentVisitorsRow?.count ?? 0,
        activeCampaigns: activeCampaignsRow?.count ?? 0,
        conversionVelocity15m: conversionVelocity15mRow?.count ?? 0,
        conversionVelocityDeltaPct: 0,
        alertsOpen: 0,
      },
    });
  });

  fastify.get<{ Querystring: { campaignId?: string; limit?: string } }>('/ops/live-events', async (request, reply) => {
    const limit = Number.parseInt(request.query.limit ?? '50', 10);
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
    // L-2: only accept a well-formed UUID; ignore anything else rather than passing junk to the query.
    const rawCampaignId = request.query.campaignId?.trim();
    const campaignId = rawCampaignId && UUID_RE.test(rawCampaignId) ? rawCampaignId : undefined;

    const rows = await db
      .select({
        ts: events.ts,
        eventType: events.eventType,
        campaignId: events.campaignId,
        sessionId: events.sessionId,
        visitorId: events.visitorId,
        device: events.device,
        metadata: events.metadata,
      })
      .from(events)
      .where(
        and(
          eq(events.tenantId, request.tenantId),
          ...(campaignId ? [eq(events.campaignId, campaignId)] : [])
        )
      )
      .orderBy(sql`${events.ts} desc`)
      .limit(safeLimit);

    return reply.send({
      data: rows.map((row, idx) => ({
        id: `${row.campaignId}-${idx}-${new Date(row.ts).getTime()}`,
        ts: row.ts,
        campaignId: row.campaignId,
        eventType: row.eventType,
        sessionId: row.sessionId,
        visitorId: row.visitorId,
        device: row.device ?? 'unknown',
        meta: row.metadata ?? {},
      })),
    });
  });

  fastify.get('/ops/campaign-health', async (request, reply) => {
    const rows = await db
      .select({
        campaignId: events.campaignId,
        impressions: sql<number>`count(*) filter (where ${events.eventType} = 'impression')::int`,
        clicks: sql<number>`count(*) filter (where ${events.eventType} = 'click')::int`,
        dismissals: sql<number>`count(*) filter (where ${events.eventType} = 'dismiss')::int`,
      })
      .from(events)
      .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since30d())))
      .groupBy(events.campaignId);

    return reply.send({
      data: rows.map((row) => {
        const ctr = row.impressions > 0 ? row.clicks / row.impressions : 0;
        const dismissRate = row.impressions > 0 ? row.dismissals / row.impressions : 0;
        const healthScore = Math.max(0, Math.min(100, Math.round((ctr * 1000) - dismissRate * 20 + 50)));
        return {
          campaignId: row.campaignId,
          status: healthScore >= 70 ? 'healthy' : healthScore >= 45 ? 'watch' : 'failing',
          impressions: row.impressions,
          clicks: row.clicks,
          ctr: Number(ctr.toFixed(4)),
          dismissRate: Number(dismissRate.toFixed(4)),
          healthScore,
          trend: 'flat',
        };
      }),
    });
  });

  fastify.get('/ops/insights', async (request, reply) => {
    const rows = await db
      .select({
        campaignId: events.campaignId,
        impressions: sql<number>`count(*) filter (where ${events.eventType} = 'impression')::int`,
        clicks: sql<number>`count(*) filter (where ${events.eventType} = 'click')::int`,
        dismissals: sql<number>`count(*) filter (where ${events.eventType} = 'dismiss')::int`,
      })
      .from(events)
      .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since30d())))
      .groupBy(events.campaignId);

    const insights: Array<{ id: string; severity: 'low' | 'medium' | 'high'; title: string; body: string; campaignId?: string; confidence: number }> = [];

    for (const row of rows) {
      const ctr = row.impressions > 0 ? row.clicks / row.impressions : 0;
      const dismissRate = row.impressions > 0 ? row.dismissals / row.impressions : 0;
      if (dismissRate > 0.7) {
        insights.push({
          id: `dismiss-${row.campaignId}`,
          severity: 'high',
          campaignId: row.campaignId,
          title: 'High dismissal pressure',
          body: `Dismissal rate is ${(dismissRate * 100).toFixed(0)}%. Consider delayed trigger or softer entry.`,
          confidence: 0.82,
        });
      }
      if (row.impressions > 100 && ctr < 0.01) {
        insights.push({
          id: `ctr-${row.campaignId}`,
          severity: 'medium',
          campaignId: row.campaignId,
          title: 'Low click-through efficiency',
          body: `CTR is ${(ctr * 100).toFixed(2)}% with material traffic. Test new copy and CTA.`,
          confidence: 0.74,
        });
      }
      if (row.impressions < 25) {
        insights.push({
          id: `traffic-${row.campaignId}`,
          severity: 'low',
          campaignId: row.campaignId,
          title: 'Low journey exposure',
          body: 'Very low impressions detected. Check targeting, schedule windows, and status.',
          confidence: 0.68,
        });
      }
    }

    if (insights.length === 0) {
      insights.push({
        id: 'stable',
        severity: 'low',
        title: 'No critical issues detected',
        body: 'Current campaign set appears stable over the trailing 30 days.',
        confidence: 0.71,
      });
    }

    return reply.send({ data: insights.slice(0, 12) });
  });

  fastify.get('/ops/stream', async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (event: string, payload: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    send('connected', { ok: true, ts: new Date().toISOString() });

    const timer = setInterval(async () => {
      try {
        const [visitors] = await db
          .select({ count: sql<number>`count(distinct ${events.visitorId})::int` })
          .from(events)
          .where(and(eq(events.tenantId, request.tenantId), gte(events.ts, since15m())));
        send('ops_kpi_update', {
          activeVisitorsNow: visitors?.count ?? 0,
          ts: new Date().toISOString(),
        });
      } catch {
        send('heartbeat', { ts: new Date().toISOString() });
      }
    }, 5000);

    request.raw.on('close', () => {
      clearInterval(timer);
      reply.raw.end();
    });
  });
};
