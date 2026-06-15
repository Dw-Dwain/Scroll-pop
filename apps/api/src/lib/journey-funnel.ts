/**
 * Journey step-funnel assembly (pure) — turns popup nodes + edges + per-node event counts into an
 * ordered funnel with drop-off between stages. Kept free of DB/Drizzle so it can be unit-tested in
 * isolation; the route (routes/journeys.ts GET /journeys/:id/diagnose) fetches the data and the
 * per-node counts (grouped by metadata->>'nodeId') and hands them here.
 *
 * Attribution is per-NODE, not per-campaign: a campaign reused as several popup nodes splits into
 * distinct steps, so the funnel reflects what the visitor actually walked through.
 */

export interface NodeCounts {
  impressions: number;
  views: number;
  clicks: number;
  conversions: number;
  dismissals: number;
}

export interface FunnelNodeInput {
  id: string;
  type: string;
  campaignId: string | null;
}

export interface FunnelEdgeInput {
  sourceNodeId: string;
  targetNodeId: string;
}

export interface FunnelNode extends NodeCounts {
  nodeId: string;
  campaignId: string | null;
  campaignName: string | null;
  /** Position in the funnel (0-based) from walking the graph; unreachable popups sort last. */
  order: number;
  ctr: number;
  cvr: number;
  viewRate: number;
  /** This step's impressions ÷ the previous step's impressions (drop-off). null for the first step. */
  stepRetention: number | null;
}

export interface JourneyFunnel {
  totals: NodeCounts;
  nodes: FunnelNode[];
}

const ZERO: NodeCounts = { impressions: 0, views: 0, clicks: 0, conversions: 0, dismissals: 0 };

/** Ratio in [0,1] rounded to 4 dp; 0 when the denominator is 0 (avoids div-by-zero + >100% rates). */
export const clamp01 = (n: number, d: number): number => (d > 0 ? Math.min(1, Number((n / d).toFixed(4))) : 0);

/**
 * Number popup nodes in funnel order by BFS from the entry node along edges. Popups not reachable
 * from entry are appended after the reachable ones (still surfaced, just ordered last). Returns a
 * map nodeId → order index.
 */
export function orderPopupNodes(nodes: FunnelNodeInput[], edges: FunnelEdgeInput[]): Map<string, number> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.sourceNodeId);
    if (list) list.push(e.targetNodeId);
    else adj.set(e.sourceNodeId, [e.targetNodeId]);
  }
  const typeById = new Map(nodes.map((n) => [n.id, n.type]));
  const order = new Map<string, number>();
  let idx = 0;
  const entry = nodes.find((n) => n.type === 'entry');
  const seen = new Set<string>();
  const queue: string[] = entry ? [entry.id] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    if (typeById.get(id) === 'popup') order.set(id, idx++);
    for (const t of adj.get(id) ?? []) if (!seen.has(t)) queue.push(t);
  }
  // Any popup the BFS didn't reach (disconnected / no entry) still gets an order, after the rest.
  for (const n of nodes) if (n.type === 'popup' && !order.has(n.id)) order.set(n.id, idx++);
  return order;
}

export function buildJourneyFunnel(params: {
  nodes: FunnelNodeInput[];
  edges: FunnelEdgeInput[];
  counts: Map<string, Partial<NodeCounts>>;
  nameById: Map<string, string>;
}): JourneyFunnel {
  const { nodes, edges, counts, nameById } = params;
  const popups = nodes.filter((n) => n.type === 'popup');
  const order = orderPopupNodes(nodes, edges);

  const ordered = popups
    .map((p) => {
      const c = { ...ZERO, ...(counts.get(p.id) ?? {}) };
      return {
        nodeId: p.id,
        campaignId: p.campaignId,
        campaignName: (p.campaignId && nameById.get(p.campaignId)) || null,
        order: order.get(p.id) ?? Number.MAX_SAFE_INTEGER,
        impressions: c.impressions,
        views: c.views,
        clicks: c.clicks,
        conversions: c.conversions,
        dismissals: c.dismissals,
        ctr: clamp01(c.clicks, c.impressions),
        cvr: clamp01(c.conversions, c.impressions),
        viewRate: clamp01(c.views, c.impressions),
      };
    })
    .sort((a, b) => a.order - b.order);

  const nodesOut: FunnelNode[] = ordered.map((n, i) => ({
    ...n,
    stepRetention: i > 0 ? clamp01(n.impressions, ordered[i - 1]!.impressions) : null,
  }));

  const totals = nodesOut.reduce<NodeCounts>(
    (a, n) => ({
      impressions: a.impressions + n.impressions,
      views: a.views + n.views,
      clicks: a.clicks + n.clicks,
      conversions: a.conversions + n.conversions,
      dismissals: a.dismissals + n.dismissals,
    }),
    { ...ZERO },
  );

  return { totals, nodes: nodesOut };
}
