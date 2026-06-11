import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { db, systemDb } from '../db/client.js';
import { campaigns, designs, events, sites } from '../db/schema.js';
import { purgeSiteConfigCache } from '../lib/cache-purge.js';

const since30d = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
};

// Runtime guardrails enforced by the snippet's journey.js chunk — surfaced to the UI so the
// builder reflects the actual limits (it can never trap a visitor).
const JOURNEY_MAX_CHAIN = 2;   // hard cap on sequenced popups per page load
const JOURNEY_MIN_DELAY = 5;   // seconds floor between popups

// design.config can occasionally be stored as a double-encoded JSON scalar (string) — unwrap it.
function readConfig(raw: unknown): Record<string, any> {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as Record<string, any>; } catch { return {}; }
  }
  return (raw ?? {}) as Record<string, any>;
}

const LinkBody = z.object({
  // null clears the link (removes the campaign from the chain).
  nextCampaignId: z.string().uuid().nullable(),
  advanceOn: z.enum(['dismiss', 'convert', 'both']).default('dismiss'),
  delaySeconds: z.number().int().min(JOURNEY_MIN_DELAY).max(300).default(JOURNEY_MIN_DELAY),
});

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

    // Site names so the UI can group campaigns into per-site journeys (chaining is same-site only).
    const siteRows = await db
      .select({ id: sites.id, name: sites.name })
      .from(sites)
      .where(eq(sites.tenantId, request.tenantId));
    const siteName = new Map(siteRows.map((s) => [s.id, s.name]));

    return reply.send({
      data: rows.map((campaign) => {
        const design = designByCampaign.get(campaign.id);
        const config = readConfig(design?.config);
        const ui = (config.uiTriggers ?? {}) as Record<string, any>;
        return {
          id: campaign.id,
          campaignId: campaign.id,
          name: campaign.name,
          status: campaign.status,
          objective: config?.journeyMeta?.objective ?? 'lead_capture',
          format: design?.kind ?? 'modal',
          siteId: campaign.siteId,
          siteName: campaign.siteId ? siteName.get(campaign.siteId) ?? null : null,
          createdAt: campaign.createdAt,
          // The chain edge out of this node (what plays next, and when).
          sequence: ui.sequenceNextCampaignId
            ? {
                nextCampaignId: ui.sequenceNextCampaignId as string,
                advanceOn: (ui.sequenceAdvanceOn as string) ?? 'dismiss',
                delaySeconds: Number(ui.sequenceDelaySeconds) || JOURNEY_MIN_DELAY,
              }
            : null,
        };
      }),
      meta: { maxChain: JOURNEY_MAX_CHAIN, minDelaySeconds: JOURNEY_MIN_DELAY },
    });
  });

  // PUT /journeys/:id/link — set or clear this campaign's "advance to next" edge. Writes the
  // sequence fields into design.config.uiTriggers, which is exactly what the snippet's journey.js
  // chunk consumes — so the chain runs live with no snippet change. Chaining is constrained to the
  // SAME site (the runtime is same-page/same-domain) and can't point at itself.
  fastify.put<{ Params: { id: string } }>('/journeys/:id/link', async (request, reply) => {
    const body = LinkBody.parse(request.body);

    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, request.params.id), eq(campaigns.tenantId, request.tenantId), isNull(campaigns.deletedAt)),
    });
    if (!campaign) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });

    if (body.nextCampaignId) {
      if (body.nextCampaignId === request.params.id) {
        return reply.code(400).send({ error: { code: 'INVALID_LINK', message: 'A campaign cannot chain to itself' } });
      }
      const next = await db.query.campaigns.findFirst({
        where: and(eq(campaigns.id, body.nextCampaignId), eq(campaigns.tenantId, request.tenantId), isNull(campaigns.deletedAt)),
        columns: { id: true, siteId: true },
      });
      if (!next) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Next campaign not found' } });
      if (next.siteId !== campaign.siteId) {
        return reply.code(400).send({ error: { code: 'CROSS_SITE_LINK', message: 'Journeys can only chain campaigns on the same site' } });
      }
    }

    // systemDb (normal pool) — drizzle .transaction() throws on the RLS tenant pool's reserved
    // connection. Ownership verified above; every write is scoped to request.tenantId.
    const result = await systemDb.transaction(async (tx) => {
      const design = await tx.query.designs.findFirst({
        where: and(eq(designs.campaignId, request.params.id), eq(designs.tenantId, request.tenantId)),
      });
      if (!design) return { notFound: true as const };

      const config = readConfig(design.config);
      const ui = { ...((config.uiTriggers ?? {}) as Record<string, unknown>) };

      if (body.nextCampaignId) {
        ui['sequenceNextCampaignId'] = body.nextCampaignId;
        ui['sequenceAdvanceOn'] = body.advanceOn;
        ui['sequenceDelaySeconds'] = body.delaySeconds;
      } else {
        delete ui['sequenceNextCampaignId'];
        delete ui['sequenceAdvanceOn'];
        delete ui['sequenceDelaySeconds'];
      }

      await tx.update(designs)
        .set({ config: { ...config, uiTriggers: ui }, updatedAt: new Date() })
        .where(eq(designs.id, design.id));
      return { notFound: false as const, siteId: campaign.siteId };
    });

    if (result.notFound) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Design not found — open the campaign in the designer once to create it' } });
    }

    // Bust the edge config cache so the new chain serves immediately.
    if (result.siteId) {
      try {
        const site = await db.query.sites.findFirst({ where: eq(sites.id, result.siteId), columns: { publicKey: true } });
        if (site?.publicKey) await purgeSiteConfigCache(site.publicKey);
      } catch { /* best-effort — 60s TTL is the fallback */ }
    }

    return reply.send({
      data: {
        campaignId: request.params.id,
        sequence: body.nextCampaignId
          ? { nextCampaignId: body.nextCampaignId, advanceOn: body.advanceOn, delaySeconds: body.delaySeconds }
          : null,
      },
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

