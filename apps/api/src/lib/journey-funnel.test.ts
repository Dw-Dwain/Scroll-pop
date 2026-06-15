import { describe, it, expect } from 'vitest';
import {
  buildJourneyFunnel,
  orderPopupNodes,
  clamp01,
  type FunnelNodeInput,
  type FunnelEdgeInput,
  type NodeCounts,
} from './journey-funnel.js';

const counts = (c: Partial<NodeCounts>) => c;

describe('clamp01', () => {
  it('returns a 4-dp ratio in [0,1]', () => {
    expect(clamp01(12, 21)).toBe(0.5714);
    expect(clamp01(2, 12)).toBe(0.1667);
  });
  it('is 0 when the denominator is 0 (never divides by zero)', () => {
    expect(clamp01(5, 0)).toBe(0);
  });
  it('never exceeds 1, even if a step somehow out-counts its predecessor', () => {
    expect(clamp01(30, 21)).toBe(1);
  });
});

describe('orderPopupNodes', () => {
  it('numbers popups in BFS order from the entry node', () => {
    const nodes: FunnelNodeInput[] = [
      { id: 'p2', type: 'popup', campaignId: 'c2' },
      { id: 'entry', type: 'entry', campaignId: null },
      { id: 'p1', type: 'popup', campaignId: 'c1' },
      { id: 'd1', type: 'delay', campaignId: null },
    ];
    // entry → p1 → delay → p2 (popups should come out p1 then p2 regardless of array order)
    const edges: FunnelEdgeInput[] = [
      { sourceNodeId: 'entry', targetNodeId: 'p1' },
      { sourceNodeId: 'p1', targetNodeId: 'd1' },
      { sourceNodeId: 'd1', targetNodeId: 'p2' },
    ];
    const order = orderPopupNodes(nodes, edges);
    expect(order.get('p1')).toBe(0);
    expect(order.get('p2')).toBe(1);
  });

  it('appends popups unreachable from entry after the reachable ones', () => {
    const nodes: FunnelNodeInput[] = [
      { id: 'entry', type: 'entry', campaignId: null },
      { id: 'p1', type: 'popup', campaignId: 'c1' },
      { id: 'orphan', type: 'popup', campaignId: 'c9' },
    ];
    const edges: FunnelEdgeInput[] = [{ sourceNodeId: 'entry', targetNodeId: 'p1' }];
    const order = orderPopupNodes(nodes, edges);
    expect(order.get('p1')).toBe(0);
    expect(order.get('orphan')).toBe(1); // still numbered, just last
  });

  it('does not loop forever on a cyclic graph', () => {
    const nodes: FunnelNodeInput[] = [
      { id: 'entry', type: 'entry', campaignId: null },
      { id: 'p1', type: 'popup', campaignId: 'c1' },
      { id: 'p2', type: 'popup', campaignId: 'c2' },
    ];
    const edges: FunnelEdgeInput[] = [
      { sourceNodeId: 'entry', targetNodeId: 'p1' },
      { sourceNodeId: 'p1', targetNodeId: 'p2' },
      { sourceNodeId: 'p2', targetNodeId: 'p1' }, // cycle back
    ];
    const order = orderPopupNodes(nodes, edges);
    expect(order.get('p1')).toBe(0);
    expect(order.get('p2')).toBe(1);
  });
});

describe('buildJourneyFunnel', () => {
  const nodes: FunnelNodeInput[] = [
    { id: 'entry', type: 'entry', campaignId: null },
    { id: 'p1', type: 'popup', campaignId: 'c1' },
    { id: 'p2', type: 'popup', campaignId: 'c2' },
    { id: 'p3', type: 'popup', campaignId: 'c3' },
    { id: 'goal', type: 'goal', campaignId: null },
  ];
  const edges: FunnelEdgeInput[] = [
    { sourceNodeId: 'entry', targetNodeId: 'p1' },
    { sourceNodeId: 'p1', targetNodeId: 'p2' },
    { sourceNodeId: 'p2', targetNodeId: 'p3' },
    { sourceNodeId: 'p3', targetNodeId: 'goal' },
  ];
  const nameById = new Map([['c1', 'Welcome'], ['c2', 'Offer'], ['c3', 'Last call']]);

  it('builds the 21 → 12 → 2 funnel with per-step retention', () => {
    const counter = new Map<string, Partial<NodeCounts>>([
      ['p1', counts({ impressions: 21, views: 18, clicks: 6, conversions: 1, dismissals: 9 })],
      ['p2', counts({ impressions: 12, views: 10, clicks: 4, conversions: 1, dismissals: 5 })],
      ['p3', counts({ impressions: 2, views: 2, clicks: 1, conversions: 0, dismissals: 1 })],
    ]);
    const { totals, nodes: out } = buildJourneyFunnel({ nodes, edges, counts: counter, nameById });

    expect(out.map((n) => n.nodeId)).toEqual(['p1', 'p2', 'p3']);
    expect(out.map((n) => n.campaignName)).toEqual(['Welcome', 'Offer', 'Last call']);
    expect(out.map((n) => n.impressions)).toEqual([21, 12, 2]);

    // Drop-off: first step has no predecessor; then 12/21 and 2/12.
    expect(out[0]!.stepRetention).toBeNull();
    expect(out[1]!.stepRetention).toBe(0.5714);
    expect(out[2]!.stepRetention).toBe(0.1667);

    // Rates derive from each node's own impressions.
    expect(out[0]!.ctr).toBe(clamp01(6, 21));
    expect(out[0]!.viewRate).toBe(clamp01(18, 21));

    expect(totals).toEqual({ impressions: 35, views: 30, clicks: 11, conversions: 2, dismissals: 15 });
  });

  it('reports zeros (not gaps) for popup nodes with no tagged events yet', () => {
    const { totals, nodes: out } = buildJourneyFunnel({ nodes, edges, counts: new Map(), nameById });
    expect(out).toHaveLength(3);
    expect(out.every((n) => n.impressions === 0 && n.ctr === 0)).toBe(true);
    expect(totals.impressions).toBe(0);
    // first step null (no predecessor); the rest 0 (0/0 → 0).
    expect(out[0]!.stepRetention).toBeNull();
    expect(out[1]!.stepRetention).toBe(0);
  });

  it('keeps two nodes that share one campaign as separate steps', () => {
    const sharedNodes: FunnelNodeInput[] = [
      { id: 'entry', type: 'entry', campaignId: null },
      { id: 'a', type: 'popup', campaignId: 'same' },
      { id: 'b', type: 'popup', campaignId: 'same' },
    ];
    const sharedEdges: FunnelEdgeInput[] = [
      { sourceNodeId: 'entry', targetNodeId: 'a' },
      { sourceNodeId: 'a', targetNodeId: 'b' },
    ];
    const counter = new Map<string, Partial<NodeCounts>>([
      ['a', counts({ impressions: 10 })],
      ['b', counts({ impressions: 4 })],
    ]);
    const { nodes: out } = buildJourneyFunnel({
      nodes: sharedNodes, edges: sharedEdges, counts: counter, nameById: new Map([['same', 'Repeat ad']]),
    });
    expect(out.map((n) => n.nodeId)).toEqual(['a', 'b']);
    expect(out.map((n) => n.impressions)).toEqual([10, 4]); // NOT merged into 14 on one campaign row
    expect(out[1]!.stepRetention).toBe(0.4);
  });
});
