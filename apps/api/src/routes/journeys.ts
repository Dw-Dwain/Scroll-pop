import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, eq, gte, isNull, inArray, asc, sql } from 'drizzle-orm';
import { db, systemDb } from '../db/client.js';
import { journeys, journeyNodes, journeyEdges, campaigns, designs, sites, events, tenants } from '../db/schema.js';
import { purgeSiteConfigCache } from '../lib/cache-purge.js';

/**
 * Journeys API — node-based multi-step flows (the real engine; replaces the legacy 2-popup
 * design.config.uiTriggers chain). A journey is a directed graph:
 *   entry → popup → delay → condition → split → goal, connected by branch-carrying edges.
 *
 * CRUD + a whole-graph save (the canvas autosaves the full node/edge set) + publish, which
 * VALIDATES and COMPILES the graph into journeys.compiled — the compact form internal/config
 * serves to the snippet's journey engine. All routes tenant-scoped via request.tenantId.
 *
 * Writes that span multiple tables use systemDb.transaction() (drizzle .transaction() throws on
 * the RLS tenant pool's reserved connection); ownership is verified on the tenant pool first and
 * every write is scoped by tenant_id (defence in depth).
 */

// Runtime guardrails the snippet engine ALSO enforces (surfaced so the builder reflects limits).
const JOURNEY_MAX_POPUPS = 4;   // hard cap on popups shown per journey run (anti-trap)
const JOURNEY_MIN_DELAY = 1;    // seconds floor on any delay node (operators can set 1s+ per step)

const since30d = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
};

// ── Graph payload schemas (whole-graph save) ──────────────────────────────────
const NodeInput = z.object({
  id: z.string().uuid(),
  type: z.enum(['entry', 'popup', 'delay', 'condition', 'split', 'goal']),
  campaignId: z.string().uuid().nullable().optional(),
  config: z.record(z.unknown()).default({}),
  posX: z.number().int().default(0),
  posY: z.number().int().default(0),
});
const EdgeInput = z.object({
  id: z.string().uuid(),
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  branch: z.enum(['always', 'dismiss', 'convert', 'timeout', 'true', 'false', 'split']).default('always'),
  config: z.record(z.unknown()).default({}),
});
const GraphInput = z.object({
  nodes: z.array(NodeInput).max(60),
  edges: z.array(EdgeInput).max(120),
});

type NodeRow = z.infer<typeof NodeInput>;
type EdgeRow = z.infer<typeof EdgeInput>;

// ── Compile + validate ────────────────────────────────────────────────────────
interface CompileResult {
  ok: boolean;
  errors: string[];
  compiled?: Record<string, unknown>;
  popupCampaignIds: string[];
}

/**
 * Validate the graph and compile it into the compact runtime form. Pure (no DB) — the caller
 * supplies the campaign-validity set so this stays unit-testable.
 */
export function compileJourney(nodes: NodeRow[], edges: EdgeRow[]): CompileResult {
  const errors: string[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const entries = nodes.filter((n) => n.type === 'entry');
  if (entries.length === 0) errors.push('Journey needs an entry node.');
  if (entries.length > 1) errors.push('Journey can only have one entry node.');
  const goals = nodes.filter((n) => n.type === 'goal');
  if (goals.length === 0) errors.push('Journey needs at least one goal node.');

  // Edges must reference real nodes; no self-loops.
  for (const e of edges) {
    if (!byId.has(e.sourceNodeId)) errors.push(`Edge ${e.id} has an unknown source node.`);
    if (!byId.has(e.targetNodeId)) errors.push(`Edge ${e.id} has an unknown target node.`);
    if (e.sourceNodeId === e.targetNodeId) errors.push('A node cannot connect to itself.');
  }

  // Entry trigger present.
  const entry = entries[0];
  let trigger: Record<string, unknown> | undefined;
  if (entry) {
    trigger = (entry.config?.['trigger'] as Record<string, unknown> | undefined);
    if (!trigger || typeof trigger['type'] !== 'string') {
      errors.push('The entry node needs a trigger (e.g. scroll %, dwell time, exit intent).');
    }
  }

  // Popup nodes must reference a campaign.
  const popupCampaignIds: string[] = [];
  for (const n of nodes) {
    if (n.type === 'popup') {
      if (!n.campaignId) errors.push('Every popup node must choose a campaign to show.');
      else popupCampaignIds.push(n.campaignId);
    }
  }

  // Adjacency, keyed by source.
  const outBySource = new Map<string, EdgeRow[]>();
  for (const e of edges) {
    const arr = outBySource.get(e.sourceNodeId);
    if (arr) arr.push(e);
    else outBySource.set(e.sourceNodeId, [e]);
  }

  // Goal reachable from entry (BFS).
  if (entry && goals.length) {
    const seen = new Set<string>([entry.id]);
    const queue = [entry.id];
    let reachedGoal = false;
    while (queue.length) {
      const cur = queue.shift()!;
      if (byId.get(cur)?.type === 'goal') { reachedGoal = true; break; }
      for (const e of outBySource.get(cur) ?? []) {
        if (!seen.has(e.targetNodeId)) { seen.add(e.targetNodeId); queue.push(e.targetNodeId); }
      }
    }
    if (!reachedGoal) errors.push('No goal is reachable from the entry — connect the flow through to a goal.');
  }

  // Delay floor.
  for (const n of nodes) {
    if (n.type === 'delay') {
      const secs = Number(n.config?.['seconds']);
      if (n.config?.['untilNextPageview'] !== true && (!Number.isFinite(secs) || secs < JOURNEY_MIN_DELAY)) {
        errors.push(`Delay nodes must wait at least ${JOURNEY_MIN_DELAY}s (or "until next pageview").`);
      }
    }
  }

  if (errors.length) return { ok: false, errors, popupCampaignIds };

  // ── Compile to compact runtime form ──────────────────────────────────────────
  const compiledNodes = nodes.map((n) => {
    const outs = outBySource.get(n.id) ?? [];
    const next: Record<string, string> = {};
    const node: Record<string, unknown> = { id: n.id, type: n.type };
    if (n.campaignId) node['campaignId'] = n.campaignId;
    if (n.config && Object.keys(n.config).length) node['config'] = n.config;

    if (n.type === 'split') {
      // Weighted random branch: enumerate outgoing edges as "0","1",… with parallel weights.
      const weights: number[] = [];
      outs.forEach((e, i) => {
        next[String(i)] = e.targetNodeId;
        weights.push(Math.max(0, Number(e.config?.['weight']) || 0));
      });
      node['config'] = { ...(node['config'] as object ?? {}), weights };
    } else {
      // One target per branch outcome (last wins if duplicated).
      for (const e of outs) next[e.branch] = e.targetNodeId;
    }
    node['next'] = next;
    return node;
  });

  return {
    ok: true,
    errors: [],
    popupCampaignIds,
    compiled: {
      id: '', // filled by caller (journey id)
      entryNodeId: entry!.id,
      trigger: trigger ?? null,
      maxPopups: JOURNEY_MAX_POPUPS,
      minDelay: JOURNEY_MIN_DELAY,
      nodes: compiledNodes,
    },
  };
}

export const journeyRoutes: FastifyPluginAsync = async (fastify) => {
  // Server-side feature gate: Journeys is a Scale + Agency feature. Mirrors the dashboard's
  // meetsMinPlan('scale') so a non-Scale tenant can't drive the API directly. Unlimited bypasses.
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.isUnlimited) return;
    const t = await db.query.tenants.findFirst({ where: eq(tenants.id, request.tenantId), columns: { plan: true } });
    if (t?.plan !== 'scale' && t?.plan !== 'agency') {
      return reply.code(403).send({ error: { code: 'PLAN_REQUIRED', message: 'Journeys is available on the Scale and Agency plans.' } });
    }
  });

  // Verify a journey belongs to the tenant and isn't deleted.
  const getJourney = (tenantId: string, id: string) =>
    db.query.journeys.findFirst({
      where: and(eq(journeys.id, id), eq(journeys.tenantId, tenantId), isNull(journeys.deletedAt)),
    });

  const purgeForSite = async (siteId: string | null) => {
    if (!siteId) return;
    try {
      const s = await db.query.sites.findFirst({ where: eq(sites.id, siteId), columns: { publicKey: true } });
      if (s?.publicKey) await purgeSiteConfigCache(s.publicKey);
    } catch { /* best-effort — TTL is the fallback */ }
  };

  // GET /journeys — list (optional ?siteId=)
  fastify.get('/journeys', async (request, reply) => {
    const { siteId } = z.object({ siteId: z.string().uuid().optional() }).parse(request.query);
    const rows = await db.query.journeys.findMany({
      where: and(
        eq(journeys.tenantId, request.tenantId),
        isNull(journeys.deletedAt),
        siteId ? eq(journeys.siteId, siteId) : undefined,
      ),
      orderBy: [asc(journeys.createdAt)],
    });

    // Per-journey node counts in one query.
    const ids = rows.map((j) => j.id);
    const counts = ids.length
      ? await db
          .select({ journeyId: journeyNodes.journeyId, n: sql<number>`count(*)::int` })
          .from(journeyNodes)
          .where(and(eq(journeyNodes.tenantId, request.tenantId), inArray(journeyNodes.journeyId, ids)))
          .groupBy(journeyNodes.journeyId)
      : [];
    const countByJourney = new Map(counts.map((c) => [c.journeyId, c.n]));

    return reply.send({
      data: rows.map((j) => ({
        id: j.id,
        name: j.name,
        description: j.description,
        siteId: j.siteId,
        status: j.status,
        version: j.version,
        publishedAt: j.publishedAt,
        nodeCount: countByJourney.get(j.id) ?? 0,
        updatedAt: j.updatedAt,
        createdAt: j.createdAt,
      })),
      meta: { maxPopups: JOURNEY_MAX_POPUPS, minDelaySeconds: JOURNEY_MIN_DELAY },
    });
  });

  // GET /journeys/:id — full graph (nodes + edges) for the builder
  fastify.get<{ Params: { id: string } }>('/journeys/:id', async (request, reply) => {
    const journey = await getJourney(request.tenantId, request.params.id);
    if (!journey) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Journey not found' } });

    const [nodes, edges] = await Promise.all([
      db.query.journeyNodes.findMany({
        where: and(eq(journeyNodes.journeyId, journey.id), eq(journeyNodes.tenantId, request.tenantId)),
      }),
      db.query.journeyEdges.findMany({
        where: and(eq(journeyEdges.journeyId, journey.id), eq(journeyEdges.tenantId, request.tenantId)),
      }),
    ]);

    return reply.send({
      data: {
        id: journey.id,
        name: journey.name,
        description: journey.description,
        siteId: journey.siteId,
        status: journey.status,
        startsAt: journey.startsAt,
        endsAt: journey.endsAt,
        targeting: journey.targeting ?? [],
        frequency: journey.frequency ?? 'once_per_visitor',
        version: journey.version,
        publishedAt: journey.publishedAt,
        nodes: nodes.map((n) => ({
          id: n.id, type: n.type, campaignId: n.campaignId, config: n.config, posX: n.posX, posY: n.posY,
        })),
        edges: edges.map((e) => ({
          id: e.id, sourceNodeId: e.sourceNodeId, targetNodeId: e.targetNodeId, branch: e.branch, config: e.config,
        })),
      },
    });
  });

  // POST /journeys — create a journey, seeded with an entry node so the canvas opens non-empty
  fastify.post('/journeys', async (request, reply) => {
    const body = z.object({
      name: z.string().min(1).max(120),
      description: z.string().max(2000).optional(),
      siteId: z.string().uuid().nullable().optional(),
      startsAt: z.string().datetime().nullable().optional(),
      endsAt: z.string().datetime().nullable().optional(),
    }).parse(request.body);

    // If a site is given, confirm it's the tenant's.
    if (body.siteId) {
      const site = await db.query.sites.findFirst({
        where: and(eq(sites.id, body.siteId), eq(sites.tenantId, request.tenantId), isNull(sites.deletedAt)),
        columns: { id: true },
      });
      if (!site) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Site not found' } });
    }

    const created = await systemDb.transaction(async (tx) => {
      const [j] = await tx.insert(journeys).values({
        tenantId: request.tenantId,
        siteId: body.siteId ?? null,
        name: body.name,
        description: body.description ?? null,
        status: 'draft',
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      }).returning();
      // Seed an entry node (top-left) so the builder starts from a real starting point.
      await tx.insert(journeyNodes).values({
        tenantId: request.tenantId,
        journeyId: j!.id,
        type: 'entry',
        // Trigger stored in TriggerConfig shape ({ type, params }) so the snippet engine can arm
        // it directly via the core's registerTrigger primitives.
        config: { trigger: { type: 'scroll_pct', params: { pct: 50 } } },
        posX: 80,
        posY: 80,
      });
      return j!;
    });

    return reply.code(201).send({ data: { id: created.id, name: created.name, status: created.status } });
  });

  // PUT /journeys/:id — update metadata (name / description / status)
  fastify.put<{ Params: { id: string } }>('/journeys/:id', async (request, reply) => {
    const body = z.object({
      name: z.string().min(1).max(120).optional(),
      description: z.string().max(2000).nullable().optional(),
      status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
      startsAt: z.string().datetime().nullable().optional(),
      endsAt: z.string().datetime().nullable().optional(),
      // Page targeting (URL rules, evaluated client-side) — empty array = all pages.
      targeting: z.array(z.object({
        kind: z.string().max(40),
        operator: z.enum(['include', 'exclude']).default('include'),
        value: z.record(z.unknown()).default({}),
      })).max(20).optional(),
      // How often the whole journey runs for one visitor.
      frequency: z.enum(['every_page', 'once_per_session', 'once_per_day', 'once_per_visitor']).optional(),
    }).parse(request.body);

    const journey = await getJourney(request.tenantId, request.params.id);
    if (!journey) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Journey not found' } });

    const [updated] = await systemDb.update(journeys)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.startsAt !== undefined ? { startsAt: body.startsAt ? new Date(body.startsAt) : null } : {}),
        ...(body.endsAt !== undefined ? { endsAt: body.endsAt ? new Date(body.endsAt) : null } : {}),
        ...(body.targeting !== undefined ? { targeting: body.targeting } : {}),
        ...(body.frequency !== undefined ? { frequency: body.frequency } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(journeys.id, journey.id), eq(journeys.tenantId, request.tenantId)))
      .returning();

    // Status flips, schedule, targeting, and frequency edits all change what the snippet serves and
    // are injected live at serve-time, so a re-publish isn't required for them to take effect.
    if (body.status !== undefined || body.startsAt !== undefined || body.endsAt !== undefined ||
        body.targeting !== undefined || body.frequency !== undefined) {
      await purgeForSite(journey.siteId);
    }
    return reply.send({ data: { id: updated!.id, name: updated!.name, status: updated!.status } });
  });

  // DELETE /journeys/:id — soft delete
  fastify.delete<{ Params: { id: string } }>('/journeys/:id', async (request, reply) => {
    const journey = await getJourney(request.tenantId, request.params.id);
    if (!journey) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Journey not found' } });

    await systemDb.update(journeys)
      .set({ deletedAt: new Date(), status: 'archived', updatedAt: new Date() })
      .where(and(eq(journeys.id, journey.id), eq(journeys.tenantId, request.tenantId)));

    await purgeForSite(journey.siteId);
    return reply.code(204).send();
  });

  // PUT /journeys/:id/graph — replace the whole node+edge set (canvas autosave).
  // Whole-graph replace is correct for small graphs and avoids fiddly per-element diffing; the
  // client owns node/edge UUIDs so edges stay consistent across saves.
  fastify.put<{ Params: { id: string } }>('/journeys/:id/graph', async (request, reply) => {
    const { nodes, edges } = GraphInput.parse(request.body);
    const journey = await getJourney(request.tenantId, request.params.id);
    if (!journey) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Journey not found' } });

    // Edges must reference nodes in this same save.
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const e of edges) {
      if (!nodeIds.has(e.sourceNodeId) || !nodeIds.has(e.targetNodeId)) {
        return reply.code(400).send({ error: { code: 'INVALID_GRAPH', message: 'An edge references a node not in the saved set.' } });
      }
    }

    await systemDb.transaction(async (tx) => {
      await tx.delete(journeyEdges).where(and(eq(journeyEdges.journeyId, journey.id), eq(journeyEdges.tenantId, request.tenantId)));
      await tx.delete(journeyNodes).where(and(eq(journeyNodes.journeyId, journey.id), eq(journeyNodes.tenantId, request.tenantId)));
      if (nodes.length) {
        await tx.insert(journeyNodes).values(nodes.map((n) => ({
          id: n.id,
          tenantId: request.tenantId,
          journeyId: journey.id,
          type: n.type,
          campaignId: n.campaignId ?? null,
          config: n.config,
          posX: n.posX,
          posY: n.posY,
        })));
      }
      if (edges.length) {
        await tx.insert(journeyEdges).values(edges.map((e) => ({
          id: e.id,
          tenantId: request.tenantId,
          journeyId: journey.id,
          sourceNodeId: e.sourceNodeId,
          targetNodeId: e.targetNodeId,
          branch: e.branch,
          config: e.config,
        })));
      }
      await tx.update(journeys).set({ updatedAt: new Date() })
        .where(and(eq(journeys.id, journey.id), eq(journeys.tenantId, request.tenantId)));
    });

    return reply.send({ data: { id: journey.id, nodes: nodes.length, edges: edges.length } });
  });

  // POST /journeys/:id/publish — validate, compile, activate, purge cache.
  fastify.post<{ Params: { id: string } }>('/journeys/:id/publish', async (request, reply) => {
    const journey = await getJourney(request.tenantId, request.params.id);
    if (!journey) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Journey not found' } });

    const [nodeRows, edgeRows] = await Promise.all([
      db.query.journeyNodes.findMany({ where: and(eq(journeyNodes.journeyId, journey.id), eq(journeyNodes.tenantId, request.tenantId)) }),
      db.query.journeyEdges.findMany({ where: and(eq(journeyEdges.journeyId, journey.id), eq(journeyEdges.tenantId, request.tenantId)) }),
    ]);

    const nodes: NodeRow[] = nodeRows.map((n) => ({
      id: n.id, type: n.type, campaignId: n.campaignId, config: (n.config ?? {}) as Record<string, unknown>, posX: n.posX, posY: n.posY,
    }));
    const edges: EdgeRow[] = edgeRows.map((e) => ({
      id: e.id, sourceNodeId: e.sourceNodeId, targetNodeId: e.targetNodeId, branch: e.branch as EdgeRow['branch'], config: (e.config ?? {}) as Record<string, unknown>,
    }));

    const result = compileJourney(nodes, edges);

    // Validate referenced campaigns are this tenant's, active, and on the journey's site.
    if (result.ok && result.popupCampaignIds.length) {
      const found = await db.query.campaigns.findMany({
        where: and(
          inArray(campaigns.id, result.popupCampaignIds),
          eq(campaigns.tenantId, request.tenantId),
          isNull(campaigns.deletedAt),
        ),
        columns: { id: true, status: true, siteId: true },
      });
      const foundById = new Map(found.map((c) => [c.id, c]));
      for (const cid of new Set(result.popupCampaignIds)) {
        const c = foundById.get(cid);
        if (!c) result.errors.push('A popup references a campaign that no longer exists.');
        else if (c.status !== 'active') result.errors.push('A popup references a campaign that is not active — activate it first.');
        else if (journey.siteId && c.siteId !== journey.siteId) result.errors.push('A popup references a campaign on a different site.');
      }
      if (result.errors.length) result.ok = false;
    }

    if (!result.ok) {
      return reply.code(400).send({
        error: { code: 'JOURNEY_INVALID', message: 'Journey cannot be published yet.', details: result.errors },
      });
    }

    const compiled = { ...result.compiled, id: journey.id };
    const [updated] = await systemDb.update(journeys)
      .set({ status: 'active', compiled, version: journey.version + 1, publishedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(journeys.id, journey.id), eq(journeys.tenantId, request.tenantId)))
      .returning();

    await purgeForSite(journey.siteId);
    return reply.send({ data: { id: journey.id, status: updated!.status, version: updated!.version, publishedAt: updated!.publishedAt } });
  });

  // GET /journeys/:id/diagnose — per-popup-node funnel over the last 30 days. Real campaign-level
  // event counts for each popup node (node-level attribution lands with the engine's node events).
  fastify.get<{ Params: { id: string } }>('/journeys/:id/diagnose', async (request, reply) => {
    const journey = await getJourney(request.tenantId, request.params.id);
    if (!journey) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Journey not found' } });

    const popups = await db.query.journeyNodes.findMany({
      where: and(eq(journeyNodes.journeyId, journey.id), eq(journeyNodes.tenantId, request.tenantId), eq(journeyNodes.type, 'popup')),
      columns: { id: true, campaignId: true },
    });
    const campaignIds = popups.map((p) => p.campaignId).filter((x): x is string => !!x);

    let countsByCampaign = new Map<string, { impressions: number; clicks: number; conversions: number; dismissals: number }>();
    if (campaignIds.length) {
      const rows = await db
        .select({
          campaignId: events.campaignId,
          impressions: sql<number>`count(*) filter (where ${events.eventType} = 'impression')::int`,
          clicks: sql<number>`count(*) filter (where ${events.eventType} = 'click')::int`,
          conversions: sql<number>`count(*) filter (where ${events.eventType} = 'conversion')::int`,
          dismissals: sql<number>`count(*) filter (where ${events.eventType} = 'dismiss')::int`,
        })
        .from(events)
        .where(and(eq(events.tenantId, request.tenantId), inArray(events.campaignId, campaignIds), gte(events.ts, since30d())))
        .groupBy(events.campaignId);
      countsByCampaign = new Map(rows.map((r) => [r.campaignId as string, r]));
    }

    return reply.send({
      data: {
        journeyId: journey.id,
        nodes: popups.map((p) => {
          const c = (p.campaignId && countsByCampaign.get(p.campaignId)) || { impressions: 0, clicks: 0, conversions: 0, dismissals: 0 };
          return {
            nodeId: p.id,
            campaignId: p.campaignId,
            impressions: c.impressions,
            clicks: c.clicks,
            conversions: c.conversions,
            dismissals: c.dismissals,
            ctr: c.impressions > 0 ? Number((c.clicks / c.impressions).toFixed(4)) : 0,
            cvr: c.impressions > 0 ? Number((c.conversions / c.impressions).toFixed(4)) : 0,
          };
        }),
      },
    });
  });
};
