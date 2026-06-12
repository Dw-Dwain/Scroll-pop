import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, eq, asc, sql, isNotNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { variants, campaigns, designs, events, sites, tenants } from '../db/schema.js';
import { purgeSiteConfigCache } from '../lib/cache-purge.js';

/**
 * A/B variants API (CTO-AUDIT P0-4 / P1-10). A campaign with variants is served as a weighted
 * A/B test by the snippet. All routes are tenant-scoped via request.tenantId.
 */

// Before declaring a winner we require enough data, or noise masquerades as a result.
const MIN_IMPRESSIONS = 100;   // per variant
const MIN_CONVERSIONS = 25;    // across the experiment
const CONFIDENCE_THRESHOLD = 0.95;

// Standard-normal CDF (Abramowitz-Stegun 26.2.17) — no stats dependency in packages/shared land.
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** One-sided probability that `v` beats the `base` variant on conversion rate (two-proportion z). */
function probBeatsBaseline(v: { impressions: number; conversions: number }, base: { impressions: number; conversions: number }): number {
  if (v.impressions === 0 || base.impressions === 0) return 0;
  const p1 = v.conversions / v.impressions;
  const p2 = base.conversions / base.impressions;
  const pooled = (v.conversions + base.conversions) / (v.impressions + base.impressions);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / v.impressions + 1 / base.impressions));
  if (se === 0) return p1 > p2 ? 1 : 0;
  return normalCdf((p1 - p2) / se);
}

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
  // Server-side feature gate: A/B Experiments are a Scale + Agency feature (mirrors the dashboard's
  // meetsMinPlan('scale')). Unlimited (admin/Novatise) bypasses.
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.isUnlimited) return;
    const t = await db.query.tenants.findFirst({ where: eq(tenants.id, request.tenantId), columns: { plan: true } });
    if (t?.plan !== 'scale' && t?.plan !== 'agency') {
      return reply.code(403).send({ error: { code: 'PLAN_REQUIRED', message: 'A/B Experiments are available on the Scale and Agency plans.' } });
    }
  });

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

  // GET /api/v1/variants/results?campaignId= — per-variant performance + statistical significance.
  // Significance is measured vs. the CONTROL (the variant with the most impressions) using a
  // two-proportion z-test on conversion rate. A winner is only declared once both the control and
  // the leader clear the sample-size guardrails AND the leader's confidence ≥ 95%.
  fastify.get('/variants/results', async (request, reply) => {
    const { campaignId } = z.object({ campaignId: z.string().uuid() }).parse(request.query);
    if (!(await assertCampaign(request.tenantId, campaignId))) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const [defs, agg] = await Promise.all([
      db.query.variants.findMany({
        where: and(eq(variants.tenantId, request.tenantId), eq(variants.campaignId, campaignId)),
        columns: { id: true, name: true, weight: true },
      }),
      db.select({
        variantId: events.abVariantId,
        impressions: sql<number>`count(*) filter (where ${events.eventType} = 'impression')::int`,
        clicks: sql<number>`count(*) filter (where ${events.eventType} = 'click')::int`,
        conversions: sql<number>`count(*) filter (where ${events.eventType} = 'conversion')::int`,
      })
        .from(events)
        .where(and(eq(events.tenantId, request.tenantId), eq(events.campaignId, campaignId), isNotNull(events.abVariantId)))
        .groupBy(events.abVariantId),
    ]);

    const aggById = new Map(agg.map((r) => [r.variantId as string, r]));
    const base = defs.map((d) => {
      const a = aggById.get(d.id) ?? { impressions: 0, clicks: 0, conversions: 0 };
      return { variantId: d.id, name: d.name, weight: d.weight, impressions: a.impressions, clicks: a.clicks, conversions: a.conversions };
    });

    // Control = most impressions (the established arm everything is compared against).
    const control = base.reduce<typeof base[number] | null>((best, v) => (!best || v.impressions > best.impressions ? v : best), null);
    const totalImpressions = base.reduce((s, v) => s + v.impressions, 0);
    const totalConversions = base.reduce((s, v) => s + v.conversions, 0);

    const results = base.map((v) => {
      const conversionRate = v.impressions > 0 ? v.conversions / v.impressions : 0;
      const isControl = control?.variantId === v.variantId;
      const confidence = (!control || isControl) ? undefined : probBeatsBaseline(v, control);
      const baseRate = control && control.impressions > 0 ? control.conversions / control.impressions : 0;
      const upliftPct = (!isControl && baseRate > 0) ? ((conversionRate - baseRate) / baseRate) * 100 : undefined;
      return {
        variantId: v.variantId, name: v.name, weight: v.weight,
        impressions: v.impressions, clicks: v.clicks, conversions: v.conversions,
        conversionRate: Number(conversionRate.toFixed(4)),
        confidence: confidence === undefined ? undefined : Number(confidence.toFixed(4)),
        isSignificant: confidence !== undefined && confidence >= CONFIDENCE_THRESHOLD,
        upliftPct: upliftPct === undefined ? undefined : Number(upliftPct.toFixed(1)),
        isWinner: false,
      };
    });

    // Decide a winner: enough data overall, control + leader each ≥ MIN_IMPRESSIONS, leader's
    // conversion rate beats control with ≥95% confidence.
    let winnerVariantId: string | null = null;
    const enoughData = totalConversions >= MIN_CONVERSIONS && (control?.impressions ?? 0) >= MIN_IMPRESSIONS;
    if (enoughData) {
      const leader = results
        .filter((r) => r.impressions >= MIN_IMPRESSIONS && r.isSignificant && (r.upliftPct ?? 0) > 0)
        .sort((a, b) => b.conversionRate - a.conversionRate)[0];
      if (leader) { winnerVariantId = leader.variantId; leader.isWinner = true; }
    }

    return reply.send({
      data: {
        campaignId,
        variants: results,
        decided: winnerVariantId !== null,
        winnerVariantId,
        minImpressions: MIN_IMPRESSIONS,
        totalImpressions,
      },
    });
  });

  // POST /api/v1/variants/promote — route 100% of traffic to the winner (others → weight 0).
  fastify.post('/variants/promote', async (request, reply) => {
    const { campaignId, variantId } = z.object({ campaignId: z.string().uuid(), variantId: z.string().uuid() }).parse(request.body);
    if (!(await assertCampaign(request.tenantId, campaignId))) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    const winner = await db.query.variants.findFirst({
      where: and(eq(variants.id, variantId), eq(variants.campaignId, campaignId), eq(variants.tenantId, request.tenantId)),
      columns: { id: true },
    });
    if (!winner) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Variant not found' } });

    // Winner → 100, everyone else → 0. The snippet's weighted allocation then serves only the winner.
    await db.update(variants).set({ weight: 0, updatedAt: new Date() })
      .where(and(eq(variants.campaignId, campaignId), eq(variants.tenantId, request.tenantId)));
    await db.update(variants).set({ weight: 100, updatedAt: new Date() })
      .where(and(eq(variants.id, variantId), eq(variants.tenantId, request.tenantId)));

    await purgeForCampaign(request.tenantId, campaignId);
    return reply.send({ data: { campaignId, winnerVariantId: variantId } });
  });
};
