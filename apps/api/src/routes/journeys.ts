import type { FastifyPluginAsync } from 'fastify';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { campaigns, designs, events } from '../db/schema.js';

const since30d = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
};

export const journeyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: { clientId?: string } }>('/journeys', async (request, reply) => {
    const { clientId } = request.query;
    const rows = await db.query.campaigns.findMany({
      where: and(
        eq(campaigns.tenantId, request.tenantId),
        isNull(campaigns.deletedAt),
        // Agency client scoping: restrict to campaigns whose site belongs to the active client.
        clientId
          ? sql`${campaigns.siteId} IN (SELECT id FROM sites WHERE client_id = ${clientId}::uuid AND tenant_id = ${request.tenantId}::uuid)`
          : undefined
      ),
    });

    const allDesigns = await db.query.designs.findMany({
      where: and(eq(designs.tenantId, request.tenantId)),
    });

    const designByCampaign = new Map<string, (typeof allDesigns)[number]>();
    for (const design of allDesigns) designByCampaign.set(design.campaignId, design);

    return reply.send({
      data: rows.map((campaign) => {
        const design = designByCampaign.get(campaign.id);
        const config = (design?.config ?? {}) as Record<string, any>;
        return {
          id: campaign.id,
          campaignId: campaign.id,
          name: campaign.name,
          status: campaign.status,
          objective: config?.journeyMeta?.objective ?? 'lead_capture',
          format: design?.kind ?? 'modal',
          siteId: campaign.siteId,
          createdAt: campaign.createdAt,
        };
      }),
    });
  });

  fastify.get<{ Params: { id: string } }>('/journeys/:id/diagnose', async (request, reply) => {
    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, request.params.id), eq(campaigns.tenantId, request.tenantId), isNull(campaigns.deletedAt)),
    });

    if (!campaign) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const rows = await db
      .select({
        eventType: events.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(events)
      .where(
        and(
          eq(events.tenantId, request.tenantId),
          eq(events.campaignId, request.params.id),
          gte(events.ts, since30d())
        )
      )
      .groupBy(events.eventType);

    const counts = Object.fromEntries(rows.map((r) => [r.eventType, r.count]));
    const impressions = counts['impression'] ?? 0;
    const views = counts['view'] ?? 0;
    const clicks = counts['click'] ?? 0;
    const dismissals = counts['dismiss'] ?? 0;
    const triggered = counts['trigger_fired'] ?? 0;
    const blockedTotal = counts['trigger_blocked'] ?? 0;

    // Real block-reason breakdown from trigger_blocked events (metadata.reason). No fabrication —
    // an empty array simply means nothing has been blocked yet (or the snippet predates this).
    const blockedRows = await db
      .select({
        reason: sql<string>`coalesce(${events.metadata} ->> 'reason', 'unknown')`,
        count: sql<number>`count(*)::int`,
      })
      .from(events)
      .where(
        and(
          eq(events.tenantId, request.tenantId),
          eq(events.campaignId, request.params.id),
          eq(events.eventType, 'trigger_blocked'),
          gte(events.ts, since30d())
        )
      )
      .groupBy(sql`coalesce(${events.metadata} ->> 'reason', 'unknown')`)
      .orderBy(sql`count(*) desc`);

    return reply.send({
      data: {
        campaignId: request.params.id,
        // "Rules evaluated" = times the trigger condition was met (real trigger_fired); fall back to
        // shown+blocked for campaigns whose events predate trigger_fired instrumentation.
        rulesEvaluated: triggered || impressions + blockedTotal,
        fired: impressions,
        blocked: blockedTotal,
        topBlockedReasons: blockedRows.map((r) => ({ reason: r.reason, count: r.count })),
        ctr: impressions > 0 ? Number((clicks / impressions).toFixed(4)) : 0,
        dismissRate: impressions > 0 ? Number((dismissals / impressions).toFixed(4)) : 0,
      },
    });
  });
};

