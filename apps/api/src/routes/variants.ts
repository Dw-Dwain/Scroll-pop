import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, eq, asc, sql, isNotNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { variants, campaigns, designs, events, sites } from '../db/schema.js';
import { purgeSiteConfigCache } from '../lib/cache-purge.js';

/**
 * A/B variants API (CTO-AUDIT P0-4 / P1-10). A campaign with variants is served as a weighted
 * A/B test by the snippet. All routes are tenant-scoped via request.tenantId.
 */

async function assertCampaign(tenantId: string, campaignId: string) {
  return db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)),
    columns: { id: true, siteId: true },
  });
}

async function purgeForCampaign(tenantId: string, campaignId: string): Promise<void> {
  try {
    const c = await assertCampaign(tenantId, campaignId);
    if (!c) return;
    const s = await db.query.sites.findFirst({ where: eq(sites.id, c.siteId), columns: { publicKey: true } });
    if (s?.publicKey) await purgeSiteConfigCache(s.publicKey);
  } catch { /* best-effort */ }
}

export const variantRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/variants?campaignId= — list a campaign's variants
  fastify.get('/variants', async (request, reply) => {
    const { campaignId } = z.object({ campaignId: z.string().uuid() }).parse(request.query);
    if (!(await assertCampaign(request.tenantId, campaignId))) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    const rows = await db
      // `config` is included so the Experiments page can render a real visual preview of each
      // A/B variant (not just its weight). Campaigns have only a handful of variants, so the
      // extra payload is negligible.
      .select({ id: variants.id, name: variants.name, weight: variants.weight, config: variants.config, createdAt: variants.createdAt })
      .from(variants)
      .where(and(eq(variants.tenantId, request.tenantId), eq(variants.campaignId, campaignId)))
      .orderBy(asc(variants.createdAt));
    return reply.send({ data: rows });
  });

  // GET /api/v1/variants/:id — full variant (config + slots) for the builder
  fastify.get<{ Params: { id: string } }>('/variants/:id', async (request, reply) => {
    const v = await db.query.variants.findFirst({
      where: and(eq(variants.id, request.params.id), eq(variants.tenantId, request.tenantId)),
    });
    if (!v) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Variant not found' } });
    return reply.send({ data: v });
  });

  // POST /api/v1/variants — create a variant, seeded from the campaign's base design
  fastify.post('/variants', async (request, reply) => {
    const body = z.object({
      campaignId: z.string().uuid(),
      name: z.string().min(1).max(80).optional(),
      weight: z.number().int().min(0).max(100).optional(),
    }).parse(request.body);

    if (!(await assertCampaign(request.tenantId, body.campaignId))) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    // Seed the new variant from the campaign's current base design so the operator starts from
    // the live popup and tweaks from there (rather than a blank canvas).
    const base = await db.query.designs.findFirst({
      where: and(eq(designs.campaignId, body.campaignId), eq(designs.tenantId, request.tenantId)),
      columns: { config: true, affiliateSlots: true },
    });

    const existingCount = (await db
      .select({ n: sql<number>`count(*)::int` })
      .from(variants)
      .where(and(eq(variants.tenantId, request.tenantId), eq(variants.campaignId, body.campaignId))))[0]?.n ?? 0;

    const [created] = await db.insert(variants).values({
      tenantId: request.tenantId,
      campaignId: body.campaignId,
      name: body.name ?? `Variant ${String.fromCharCode(65 + existingCount)}`, // A, B, C…
      weight: body.weight ?? 50,
      config: base?.config ?? {},
      affiliateSlots: base?.affiliateSlots ?? [],
    }).returning();

    await purgeForCampaign(request.tenantId, body.campaignId);
    return reply.code(201).send({ data: created });
  });

  // PUT /api/v1/variants/:id — update name / weight / design config
  fastify.put<{ Params: { id: string } }>('/variants/:id', async (request, reply) => {
    const body = z.object({
      name: z.string().min(1).max(80).optional(),
      weight: z.number().int().min(0).max(100).optional(),
      config: z.unknown().optional(),
      affiliateSlots: z.unknown().optional(),
    }).parse(request.body);

    const existing = await db.query.variants.findFirst({
      where: and(eq(variants.id, request.params.id), eq(variants.tenantId, request.tenantId)),
      columns: { id: true, campaignId: true },
    });
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Variant not found' } });

    const [updated] = await db.update(variants)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.weight !== undefined ? { weight: body.weight } : {}),
        ...(body.config !== undefined ? { config: body.config } : {}),
        ...(body.affiliateSlots !== undefined ? { affiliateSlots: body.affiliateSlots } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(variants.id, request.params.id), eq(variants.tenantId, request.tenantId)))
      .returning();

    await purgeForCampaign(request.tenantId, existing.campaignId);
    return reply.send({ data: updated });
  });

  // DELETE /api/v1/variants/:id
  fastify.delete<{ Params: { id: string } }>('/variants/:id', async (request, reply) => {
    const [deleted] = await db.delete(variants)
      .where(and(eq(variants.id, request.params.id), eq(variants.tenantId, request.tenantId)))
      .returning({ id: variants.id, campaignId: variants.campaignId });
    if (!deleted) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Variant not found' } });
    await purgeForCampaign(request.tenantId, deleted.campaignId);
    return reply.code(204).send();
  });

  // GET /api/v1/variants/results?campaignId= — per-variant performance breakdown
  fastify.get('/variants/results', async (request, reply) => {
    const { campaignId } = z.object({ campaignId: z.string().uuid() }).parse(request.query);
    if (!(await assertCampaign(request.tenantId, campaignId))) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    const rows = await db
      .select({
        variantId: events.abVariantId,
        impressions: sql<number>`count(*) filter (where ${events.eventType} = 'impression')::int`,
        clicks: sql<number>`count(*) filter (where ${events.eventType} = 'click')::int`,
        conversions: sql<number>`count(*) filter (where ${events.eventType} = 'conversion')::int`,
      })
      .from(events)
      .where(and(eq(events.tenantId, request.tenantId), eq(events.campaignId, campaignId), isNotNull(events.abVariantId)))
      .groupBy(events.abVariantId);
    return reply.send({ data: rows });
  });
};
