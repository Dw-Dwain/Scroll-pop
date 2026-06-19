import React from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, Handle, Position,
  type Node, type Edge, type Connection, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, ArrowLeft, Rocket, Save, Trash2, Lock, Flag, MousePointerClick, Clock, GitBranch, Split, Target, Info, SlidersHorizontal, X, BarChart3, TrendingDown } from 'lucide-react';
import { usePlan } from '../hooks/usePlan';
import { useActiveClient } from '../hooks/useClients';
import { authedFetch } from '../providers/dataProvider';
import { TargetingRuleBuilder, type PageTargetingRule } from '../components/campaign-designer/TargetingRuleBuilder';

interface JourneysProps { onNavigate: (path: string) => void }

// ── API shapes (mirror apps/api/src/routes/journeys.ts) ─────────────────────────
type NodeType = 'entry' | 'popup' | 'delay' | 'condition' | 'split' | 'goal';
type Branch = 'always' | 'dismiss' | 'convert' | 'timeout' | 'true' | 'false' | 'split';

interface JourneyListItem {
  id: string; name: string; description: string | null; siteId: string | null;
  status: string; version: number; publishedAt: string | null; nodeCount: number;
}
interface ApiNode { id: string; type: NodeType; campaignId: string | null; config: Record<string, unknown>; posX: number; posY: number }
interface ApiEdge { id: string; sourceNodeId: string; targetNodeId: string; branch: Branch; config: Record<string, unknown> }
interface ApiTargetingRule { kind: string; operator: 'include' | 'exclude'; value: Record<string, unknown> }
interface JourneyGraph {
  id: string; name: string; description: string | null; siteId: string | null;
  status: string; startsAt: string | null; endsAt: string | null; version: number;
  targeting?: ApiTargetingRule[]; frequency?: string;
  nodes: ApiNode[]; edges: ApiEdge[];
}

// Builder rule ({operator,matchType,value:string}) ⇄ API rule ({kind,operator,value:{pattern|url}})
// — the SAME mapping the campaign editor uses, so journey + campaign page-targeting behave identically.
const apiToPageRules = (t: ApiTargetingRule[] | undefined): PageTargetingRule[] =>
  (t ?? []).filter((r) => r.kind === 'url_contains' || r.kind === 'url_exact' || r.kind === 'url_regex')
    .map((r) => ({
      operator: r.operator === 'exclude' ? 'exclude' : 'include',
      matchType: r.kind === 'url_exact' ? 'exact' : r.kind === 'url_regex' ? 'regex' : 'contains',
      value: String((r.value?.['pattern'] ?? r.value?.['url'] ?? '') || ''),
    }));
const pageRulesToApi = (rules: PageTargetingRule[]): ApiTargetingRule[] =>
  rules.filter((r) => r.value.trim()).map((r) => {
    const kind = r.matchType === 'exact' ? 'url_exact' : r.matchType === 'regex' ? 'url_regex' : 'url_contains';
    const v = r.value.trim();
    return { kind, operator: r.operator, value: kind === 'url_exact' ? { url: v } : { pattern: v } };
  });
interface CampaignLite { id: string; name: string; status: string; siteId: string | null; triggerCount?: number }

// Per-step funnel (GET /journeys/:id/diagnose) — node-level attribution over the last 30 days.
interface NodeFunnel {
  nodeId: string; campaignId: string | null; campaignName: string | null; order: number;
  impressions: number; views: number; clicks: number; conversions: number; dismissals: number;
  ctr: number; cvr: number; viewRate: number; stepRetention: number | null;
}
interface DiagnoseData {
  journeyId: string; windowDays: number;
  totals: { impressions: number; views: number; clicks: number; conversions: number; dismissals: number };
  nodes: NodeFunnel[];
}

type NodeData = { kind: NodeType; campaignId?: string | null; config: Record<string, unknown>; campaignName?: string; funnel?: NodeFunnel | null };
type SpNode = Node<NodeData>;

const NODE_META: Record<NodeType, { label: string; icon: React.ReactNode; color: string; hasIn: boolean; hasOut: boolean }> = {
  entry:     { label: 'Entry',     icon: <Flag size={13} />,             color: '#16a34a', hasIn: false, hasOut: true },
  popup:     { label: 'Popup',     icon: <MousePointerClick size={13} />, color: '#6366f1', hasIn: true,  hasOut: true },
  delay:     { label: 'Delay',     icon: <Clock size={13} />,            color: '#0891b2', hasIn: true,  hasOut: true },
  condition: { label: 'Condition', icon: <GitBranch size={13} />,        color: '#d97706', hasIn: true,  hasOut: true },
  split:     { label: 'A/B Split', icon: <Split size={13} />,            color: '#db2777', hasIn: true,  hasOut: true },
  goal:      { label: 'Goal',      icon: <Target size={13} />,           color: '#059669', hasIn: true,  hasOut: false },
};

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(16).slice(2) + Date.now().toString(16));
// Stable empty fallback so `campaigns` keeps the SAME reference while the query is empty/loading —
// otherwise a fresh [] every render makes campaignName unstable and churns the editor's effects.
const NO_CAMPAIGNS: CampaignLite[] = [];

// ── Custom node renderer ────────────────────────────────────────────────────────
const SpNodeView: React.FC<NodeProps<SpNode>> = ({ data, selected }) => {
  const meta = NODE_META[data.kind];
  const subtitle =
    data.kind === 'popup'    ? (data.campaignName || (data.campaignId ? 'campaign set' : 'choose a campaign')) :
    data.kind === 'entry'    ? (((data.config?.['trigger'] as { type?: string })?.type) || 'set a trigger') :
    data.kind === 'delay'    ? (data.config?.['untilNextPageview'] ? 'until next pageview' : `${Number(data.config?.['seconds']) || 5}s`) :
    data.kind === 'condition'? (((data.config?.['rule'] as { kind?: string })?.kind) || 'set a rule') :
    data.kind === 'goal'     ? ((data.config?.['kind'] as string) || 'conversion') : '';
  return (
    <div style={{
      width: 188, borderRadius: 10, background: 'var(--bg-surface, #fff)',
      border: `1.5px solid ${selected ? meta.color : 'var(--border-subtle, #e4e4e7)'}`,
      boxShadow: selected ? `0 0 0 3px ${meta.color}22` : '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden',
    }}>
      {meta.hasIn && <Handle type="target" position={Position.Top} style={{ background: meta.color }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: meta.color, color: '#fff', fontSize: 11, fontWeight: 700 }}>
        {meta.icon}{meta.label}
      </div>
      <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted, #71717a)', minHeight: 18, wordBreak: 'break-word' }}>{subtitle}</div>
      {/* Funnel overlay: per-node counts when the Funnel toggle is on (popup nodes only). */}
      {data.kind === 'popup' && data.funnel && (
        <div style={{ display: 'flex', borderTop: '1px solid var(--border-subtle, #e4e4e7)', fontFamily: 'var(--font-mono, ui-monospace, monospace)' }}>
          <FunnelStat label="impr" value={data.funnel.impressions} />
          <FunnelStat label="view" value={data.funnel.views} />
          <FunnelStat label="click" value={data.funnel.clicks} />
          <FunnelStat label="conv" value={data.funnel.conversions} accent={meta.color} />
        </div>
      )}
      {meta.hasOut && <Handle type="source" position={Position.Bottom} style={{ background: meta.color }} />}
    </div>
  );
};
const nodeTypes = { sp: SpNodeView };

// One cell of a popup node's funnel strip (impr / view / click / conv).
const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
const FunnelStat: React.FC<{ label: string; value: number; accent?: string }> = ({ label, value, accent }) => (
  <div style={{ flex: 1, padding: '5px 4px', textAlign: 'center', borderRight: '1px solid var(--border-subtle, #e4e4e7)' }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: accent ?? 'var(--text-primary, #18181b)', lineHeight: 1.1 }}>{fmt(value)}</div>
    <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted, #71717a)' }}>{label}</div>
  </div>
);

// ── Editor ──────────────────────────────────────────────────────────────────────
// Exported so the auth-free local harness (journeys-harness.tsx) can mount the real editor
// without Clerk/API. Not used by the app shell directly (the list view renders it internally).
export const JourneyEditor: React.FC<{ journeyId: string; campaigns: CampaignLite[]; meta: { maxPopups: number; minDelaySeconds: number }; onClose: () => void }> = ({ journeyId, campaigns, meta, onClose }) => {
  const campaignName = React.useCallback((id?: string | null) => campaigns.find((c) => c.id === id)?.name ?? '', [campaigns]);
  const [nodes, setNodes, onNodesChange] = useNodesState<SpNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [journey, setJourney] = React.useState<JourneyGraph | null>(null);
  const [selNode, setSelNode] = React.useState<string | null>(null);
  const [selEdge, setSelEdge] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  // Journey-level settings (page targeting + how often it runs per visitor).
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [pageRules, setPageRules] = React.useState<PageTargetingRule[]>([]);
  const [frequency, setFrequency] = React.useState<string>('once_per_visitor');
  // Per-step funnel overlay (node-level impressions/views/clicks/conversions + drop-off).
  const [showFunnel, setShowFunnel] = React.useState(false);
  const [funnel, setFunnel] = React.useState<DiagnoseData | null>(null);
  const [funnelLoading, setFunnelLoading] = React.useState(false);

  // Load the graph.
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const res = await authedFetch(`/journeys/${journeyId}`);
      if (!res.ok || !alive) return;
      const { data } = await res.json() as { data: JourneyGraph };
      setJourney(data);
      setPageRules(apiToPageRules(data.targeting));
      setFrequency(data.frequency ?? 'once_per_visitor');
      setNodes(data.nodes.map((n) => ({
        id: n.id, type: 'sp', position: { x: n.posX, y: n.posY },
        data: { kind: n.type, campaignId: n.campaignId, config: n.config || {}, campaignName: campaignName(n.campaignId) },
      })));
      setEdges(data.edges.map((e) => ({
        id: e.id, source: e.sourceNodeId, target: e.targetNodeId, label: e.branch,
        data: { branch: e.branch }, labelStyle: { fontSize: 10, fontWeight: 700 }, animated: e.branch === 'convert',
      })));
    })();
    return () => { alive = false; };
    // ONLY re-load when the journey changes. campaignName is intentionally excluded: it changes
    // whenever the campaigns list re-renders (a fresh [] while the query is empty), and re-running
    // this effect would re-fetch the graph and OVERWRITE unsaved local nodes — the "I add a popup
    // and it disappears" bug. Labels are refreshed in place by the effect below instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyId, setNodes, setEdges]);

  // Refresh popup-node labels when the campaigns list loads/changes — in place, never re-fetching
  // the graph, so it can't wipe unsaved nodes.
  React.useEffect(() => {
    setNodes((nds) => nds.map((n) =>
      n.data.kind === 'popup' && n.data.campaignId
        ? { ...n, data: { ...n.data, campaignName: campaignName(n.data.campaignId) } }
        : n));
  }, [campaigns, campaignName, setNodes]);

  // Fetch the per-step funnel only while the overlay is on. Refetches when toggled back on so the
  // numbers are fresh after publishing/collecting more traffic.
  React.useEffect(() => {
    if (!showFunnel) return;
    let alive = true;
    setFunnelLoading(true);
    (async () => {
      try {
        const res = await authedFetch(`/journeys/${journeyId}/diagnose`);
        if (!res.ok || !alive) return;
        const { data } = await res.json() as { data: DiagnoseData };
        if (alive) setFunnel(data);
      } catch { /* leave prior data rather than crash */ }
      finally { if (alive) setFunnelLoading(false); }
    })();
    return () => { alive = false; };
  }, [showFunnel, journeyId]);

  // Attach funnel counts to popup nodes (in place, like the label refresh) so SpNodeView can paint
  // them; clear them when the overlay is off. Keyed by nodeId, so a campaign reused as two nodes
  // shows each node's own numbers.
  React.useEffect(() => {
    const byNode = new Map((funnel?.nodes ?? []).map((n) => [n.nodeId, n]));
    setNodes((nds) => nds.map((n) =>
      n.data.kind === 'popup'
        ? { ...n, data: { ...n.data, funnel: showFunnel ? (byNode.get(n.id) ?? null) : null } }
        : n));
  }, [funnel, showFunnel, setNodes]);

  const onConnect = React.useCallback((c: Connection) => {
    const src = nodes.find((n) => n.id === c.source);
    // Default branch by source type so the edge is meaningful out of the box.
    const branch: Branch = src?.data.kind === 'popup' ? 'dismiss' : src?.data.kind === 'condition' ? 'true' : src?.data.kind === 'split' ? 'split' : 'always';
    setEdges((eds) => addEdge({ ...c, id: uid(), label: branch, data: { branch }, labelStyle: { fontSize: 10, fontWeight: 700 } }, eds));
  }, [nodes, setEdges]);

  const addNode = (kind: NodeType) => {
    const id = uid();
    const config: Record<string, unknown> =
      kind === 'entry' ? { trigger: { type: 'scroll_pct', params: { pct: 50 } } } :
      kind === 'delay' ? { seconds: meta.minDelaySeconds } :
      kind === 'goal'  ? { kind: 'conversion' } :
      kind === 'condition' ? { rule: { kind: 'returning_visitor' } } : {};
    setNodes((nds) => nds.concat({ id, type: 'sp', position: { x: 120 + nds.length * 24, y: 120 + nds.length * 24 }, data: { kind, config } }));
    setSelNode(id); setSelEdge(null);
  };

  const patchNode = (id: string, patch: Partial<NodeData>) =>
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch, config: patch.config ?? n.data.config } } : n));
  const patchEdgeBranch = (id: string, branch: Branch) =>
    setEdges((eds) => eds.map((e) => e.id === id ? { ...e, label: branch, data: { ...(e.data || {}), branch } } : e));

  const toGraph = () => ({
    nodes: nodes.map((n) => ({ id: n.id, type: n.data.kind, campaignId: n.data.campaignId ?? null, config: n.data.config || {}, posX: Math.round(n.position.x), posY: Math.round(n.position.y) })),
    edges: edges.map((e) => ({ id: e.id, sourceNodeId: e.source, targetNodeId: e.target, branch: (e.data?.['branch'] as Branch) || 'always', config: {} })),
  });

  const save = async () => {
    setSaving(true); setStatus(null);
    try {
      const res = await authedFetch(`/journeys/${journeyId}/graph`, { method: 'PUT', body: JSON.stringify(toGraph()) });
      setStatus(res.ok ? { kind: 'ok', msg: '✓ Saved' } : { kind: 'err', msg: `Save failed (${res.status})` });
    } catch { setStatus({ kind: 'err', msg: 'Save failed — check your connection' }); }
    finally { setSaving(false); }
  };

  const publish = async () => {
    setSaving(true); setStatus(null);
    try {
      await authedFetch(`/journeys/${journeyId}/graph`, { method: 'PUT', body: JSON.stringify(toGraph()) }); // save first
      const res = await authedFetch(`/journeys/${journeyId}/publish`, { method: 'POST' });
      if (res.ok) { setStatus({ kind: 'ok', msg: '✓ Published — live' }); return; }
      const body = await res.json().catch(() => null) as { error?: { details?: string[]; message?: string } } | null;
      const details = body?.error?.details;
      setStatus({ kind: 'err', msg: details?.length ? details.join(' · ') : (body?.error?.message || `Publish failed (${res.status})`) });
    } catch { setStatus({ kind: 'err', msg: 'Publish failed — check your connection' }); }
    finally { setSaving(false); }
  };

  const saveSettings = async () => {
    setSavingSettings(true); setStatus(null);
    try {
      const res = await authedFetch(`/journeys/${journeyId}`, {
        method: 'PUT',
        body: JSON.stringify({ targeting: pageRulesToApi(pageRules), frequency }),
      });
      if (res.ok) { setSettingsOpen(false); setStatus({ kind: 'ok', msg: '✓ Pages & frequency saved' }); }
      else setStatus({ kind: 'err', msg: `Couldn't save settings (${res.status})` });
    } catch { setStatus({ kind: 'err', msg: 'Settings save failed — check your connection' }); }
    finally { setSavingSettings(false); }
  };

  const selectedNode = nodes.find((n) => n.id === selNode) || null;
  const selectedEdge = edges.find((e) => e.id === selEdge) || null;
  const branchOptions: Branch[] = (() => {
    const src = nodes.find((n) => n.id === selectedEdge?.source);
    if (src?.data.kind === 'popup') return ['dismiss', 'convert', 'timeout'];
    if (src?.data.kind === 'condition') return ['true', 'false'];
    if (src?.data.kind === 'split') return ['split'];
    return ['always'];
  })();

  return (
    // Full-bleed canvas with FLOATING overlay panels (not columns). The ReactFlow layer fills the
    // whole editor; the toolbar/palette/inspector float on top, so zoom/pan transform only the
    // canvas + nodes — the panels stay put.
    <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
          onNodeClick={(_, n) => { setSelNode(n.id); setSelEdge(null); }}
          onEdgeClick={(_, e) => { setSelEdge(e.id); setSelNode(null); }}
          onPaneClick={() => { setSelNode(null); setSelEdge(null); }}
          fitView fitViewOptions={{ padding: 0.28 }} proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--border-subtle)" gap={18} />
          <Controls />
          <MiniMap pannable zoomable maskColor="rgba(10,10,10,0.6)" nodeColor="#6366f1" style={{ background: '#18181b', border: '1px solid var(--border-subtle)', borderRadius: 8 }} />
        </ReactFlow>
      </div>

      {/* Floating top bar: Back / title on the left, Save / Publish on the right. */}
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', alignItems: 'flex-start', gap: 10, pointerEvents: 'none', zIndex: 5 }}>
        <div style={{ ...floatCard, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
          <button onClick={onClose} style={btn('ghost')}><ArrowLeft size={14} /> Back</button>
          <strong style={{ fontSize: 14 }}>{journey?.name ?? 'Journey'}</strong>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>v{journey?.version ?? 1} · {journey?.status}</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ ...floatCard, display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
          {status && (
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 999, maxWidth: 340, textAlign: 'right',
              color: status.kind === 'ok' ? '#16a34a' : '#dc2626',
              background: status.kind === 'ok' ? 'rgba(22,163,74,0.14)' : 'rgba(220,38,38,0.14)',
              border: `1px solid ${status.kind === 'ok' ? 'rgba(22,163,74,0.35)' : 'rgba(220,38,38,0.35)'}`,
            }}>{status.msg}</span>
          )}
          <button onClick={() => setShowFunnel((v) => !v)} style={btn(showFunnel ? 'primary' : 'ghost')} title="Per-step funnel (last 30 days)"><BarChart3 size={14} /> Funnel</button>
          <button onClick={() => setSettingsOpen(true)} style={btn('ghost')} title="Pages & frequency"><SlidersHorizontal size={14} /> Pages &amp; frequency</button>
          <button onClick={save} disabled={saving} style={btn('ghost')}><Save size={14} /> {saving ? 'Saving…' : 'Save'}</button>
          <button onClick={publish} disabled={saving} style={btn('primary')}><Rocket size={14} /> Publish</button>
        </div>
      </div>

      {/* Journey settings modal — page targeting + per-visitor frequency. */}
      {settingsOpen && (
        <div
          onClick={() => setSettingsOpen(false)}
          style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ ...floatCard, width: 440, maxWidth: '100%', maxHeight: '88%', overflowY: 'auto', padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <strong style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 7 }}><SlidersHorizontal size={15} /> Journey settings</strong>
              <button onClick={() => setSettingsOpen(false)} style={btn('ghost')}><X size={14} /></button>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', margin: '4px 0 6px' }}>How often per visitor</div>
            <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)} style={{ width: '100%', fontSize: 13 }}>
              <option value="every_page">Every page (each qualifying page view)</option>
              <option value="once_per_session">Once per session</option>
              <option value="once_per_day">Once per day</option>
              <option value="once_per_visitor">Once per visitor</option>
            </select>

            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', margin: '16px 0 6px' }}>Pages</div>
            <TargetingRuleBuilder rules={pageRules} onChange={setPageRules} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button onClick={() => setSettingsOpen(false)} style={btn('ghost')}>Cancel</button>
              <button onClick={saveSettings} disabled={savingSettings} style={btn('primary')}>{savingSettings ? 'Saving…' : 'Save settings'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating palette (left) */}
      <div style={{ ...floatCard, position: 'absolute', top: 80, left: 12, width: 150, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'calc(100% - 104px)', overflowY: 'auto', zIndex: 5 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '.05em', marginBottom: 2 }}>Add node</div>
        {(Object.keys(NODE_META) as NodeType[]).map((k) => (
          <button key={k} onClick={() => addNode(k)} style={{ ...btn('ghost'), justifyContent: 'flex-start', borderColor: NODE_META[k].color + '55' }}>
            <span style={{ color: NODE_META[k].color, display: 'flex' }}>{NODE_META[k].icon}</span> {NODE_META[k].label}
          </button>
        ))}
        <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.4, marginTop: 4 }}>
          Max {meta.maxPopups} popups/visit · {meta.minDelaySeconds}s min delay. Connect a popup's bottom handle to branch on dismiss/convert/timeout.
        </div>
      </div>

      {/* Floating inspector (right) */}
      <div style={{ ...floatCard, position: 'absolute', top: 80, right: 12, width: 264, maxHeight: 'calc(100% - 104px)', overflowY: 'auto', zIndex: 5 }}>
        {!selectedNode && !selectedEdge && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select a node or edge to edit it. Drag from a node's bottom dot to another node to connect them.</div>}
        {selectedNode && <NodeInspector node={selectedNode} campaigns={campaigns} minDelay={meta.minDelaySeconds} onPatch={(p) => patchNode(selectedNode.id, p)} onDelete={() => { setNodes((n) => n.filter((x) => x.id !== selectedNode.id)); setEdges((e) => e.filter((x) => x.source !== selectedNode.id && x.target !== selectedNode.id)); setSelNode(null); }} />}
        {selectedEdge && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Lbl>Branch (when to follow this edge)</Lbl>
            <select value={(selectedEdge.data?.['branch'] as string) || 'always'} onChange={(e) => patchEdgeBranch(selectedEdge.id, e.target.value as Branch)} style={inp}>
              {branchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <button onClick={() => { setEdges((e) => e.filter((x) => x.id !== selectedEdge.id)); setSelEdge(null); }} style={{ ...btn('ghost'), color: '#dc2626' }}><Trash2 size={13} /> Delete edge</button>
          </div>
        )}
      </div>

      {/* Floating step-funnel summary (bottom-center) — reads the drop-off across stages at a glance. */}
      {showFunnel && (
        <div style={{ ...floatCard, position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', maxWidth: 'min(680px, calc(100% - 320px))', zIndex: 5, padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: funnel && funnel.nodes.length ? 8 : 0 }}>
            <BarChart3 size={13} style={{ color: 'var(--accent, #6366f1)' }} />
            <strong style={{ fontSize: 12 }}>Step funnel</strong>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>last {funnel?.windowDays ?? 30} days · by popup node</span>
          </div>
          {funnelLoading && !funnel ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>
          ) : !funnel || funnel.nodes.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Add popup nodes to see a step funnel.</div>
          ) : funnel.totals.impressions === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 420 }}>
              No step events yet. Publish the journey and collect traffic — events are attributed per node going forward. (Views recorded before this release aren't node-tagged.)
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 4, overflowX: 'auto' }}>
              {funnel.nodes.map((n, i) => (
                <React.Fragment key={n.nodeId}>
                  {i > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 52, color: n.stepRetention != null && n.stepRetention < 0.5 ? '#d97706' : 'var(--text-muted)' }}>
                      <TrendingDown size={12} />
                      <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>
                        {n.stepRetention != null ? `${Math.round(n.stepRetention * 100)}%` : '—'}
                      </span>
                    </div>
                  )}
                  <div style={{ minWidth: 88, textAlign: 'center', padding: '6px 8px', borderRadius: 8, background: 'var(--bg-raised, rgba(99,102,241,0.06))', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Step {i + 1}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 96 }} title={n.campaignName ?? undefined}>
                      {n.campaignName || 'Popup'}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', lineHeight: 1.2 }}>{fmt(n.impressions)}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>impressions</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const NodeInspector: React.FC<{ node: SpNode; campaigns: CampaignLite[]; minDelay: number; onPatch: (p: Partial<NodeData>) => void; onDelete: () => void }> = ({ node, campaigns, minDelay, onPatch, onDelete }) => {
  const { kind, config } = node.data;
  const setConfig = (patch: Record<string, unknown>) => onPatch({ config: { ...config, ...patch } });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: NODE_META[kind].color }}>{NODE_META[kind].icon} {NODE_META[kind].label}</div>

      {kind === 'entry' && (() => {
        const t = (config['trigger'] as { type?: string; params?: Record<string, number> }) || {};
        const type = t.type || 'scroll_pct';
        const pNum = (k: string, d: number) => Number(t.params?.[k] ?? d);
        const setTrigger = (next: { type: string; params: Record<string, number> }) => setConfig({ trigger: next });
        return (
          <>
            <Lbl>Trigger</Lbl>
            <select value={type} onChange={(e) => setTrigger({ type: e.target.value, params: {} })} style={inp}>
              <option value="scroll_pct">Scroll %</option><option value="dwell_time">Time on page</option>
              <option value="inactivity">Inactivity</option><option value="exit_intent_mouse">Exit intent</option>
            </select>
            {type === 'scroll_pct' && <NumRow label="Scroll %" value={pNum('pct', 50)} onChange={(v) => setTrigger({ type, params: { pct: v } })} />}
            {(type === 'dwell_time' || type === 'inactivity') && <NumRow label="Seconds" value={pNum('seconds', 30)} onChange={(v) => setTrigger({ type, params: { seconds: v } })} />}
            {type === 'exit_intent_mouse' && <NumRow label="Sensitivity (px)" value={pNum('sensitivity', 20)} onChange={(v) => setTrigger({ type, params: { sensitivity: v } })} />}
          </>
        );
      })()}

      {kind === 'popup' && (
        <>
          <Lbl>Campaign to show</Lbl>
          <select value={node.data.campaignId ?? ''} onChange={(e) => onPatch({ campaignId: e.target.value || null, campaignName: campaigns.find((c) => c.id === e.target.value)?.name ?? '' })} style={inp}>
            <option value="">— choose —</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status !== 'active' ? ` (${c.status})` : ''}</option>)}
          </select>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Only <b>active</b> campaigns can publish. Connect this node's outputs for dismiss / convert / timeout.</div>
          {(() => {
            // Warn when the chosen campaign has its OWN triggers: those are stripped from the served
            // config for journey-step campaigns (see apps/api/src/lib/journey-config.ts), so the
            // journey — not the campaign's triggers — decides when this popup fires.
            const sel = campaigns.find((c) => c.id === node.data.campaignId);
            const n = sel?.triggerCount ?? 0;
            if (n <= 0) return null;
            return (
              <div style={{ marginTop: 2, padding: '9px 11px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Info size={13} style={{ color: 'var(--status-warning, #f59e0b)', marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Heads up: this campaign has its own {n} trigger{n > 1 ? 's' : ''}, which are <b>ignored inside a journey</b> — the journey controls when this popup fires. (They still apply if the campaign also runs standalone.)
                </span>
              </div>
            );
          })()}
        </>
      )}

      {kind === 'delay' && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input type="checkbox" checked={!!config['untilNextPageview']} onChange={(e) => setConfig({ untilNextPageview: e.target.checked })} /> Until next pageview
          </label>
          {!config['untilNextPageview'] && <NumRow label={`Seconds (min ${minDelay})`} value={Number(config['seconds']) || minDelay} onChange={(v) => setConfig({ seconds: Math.max(minDelay, v) })} />}
        </>
      )}

      {kind === 'condition' && (() => {
        const rule = (config['rule'] as { kind?: string }) || {};
        return (
          <>
            <Lbl>Branch if…</Lbl>
            <select value={rule.kind || 'returning_visitor'} onChange={(e) => setConfig({ rule: { kind: e.target.value } })} style={inp}>
              <option value="returning_visitor">Returning visitor</option>
              <option value="device">On mobile</option>
              <option value="converted">Already converted</option>
            </select>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Connect the <b>true</b> and <b>false</b> outputs.</div>
          </>
        );
      })()}

      {kind === 'split' && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Connect 2+ outputs; set each edge's weight in the edge inspector. A visitor is stuck to one arm.</div>}

      {kind === 'goal' && (
        <>
          <Lbl>Goal type</Lbl>
          <select value={(config['kind'] as string) || 'conversion'} onChange={(e) => setConfig({ kind: e.target.value })} style={inp}>
            <option value="conversion">Conversion</option><option value="lead">Lead</option><option value="click">Click</option>
          </select>
        </>
      )}

      <button onClick={onDelete} style={{ ...btn('ghost'), color: '#dc2626', marginTop: 4 }}><Trash2 size={13} /> Delete node</button>
    </div>
  );
};

// ── List view ─────────────────────────────────────────────────────────────────
export const Journeys: React.FC<JourneysProps> = () => {
  const plan = usePlan();
  const canAccess = plan.meetsMinPlan('agency'); // Journeys: Agency (and unlimited admins)
  const { activeClientId } = useActiveClient();
  const cq = activeClientId ? `?clientId=${activeClientId}` : '';
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Journeys list via authedFetch. The Refine useCustom version returned empty in production, so a
  // saved journey never showed up on the list ("it says Saved but nothing's there"). refetch() is
  // called after create/delete and when closing the editor, so the list always reflects the latest.
  const [journeys, setJourneys] = React.useState<JourneyListItem[]>([]);
  const [meta, setMeta] = React.useState<{ maxPopups: number; minDelaySeconds: number }>({ maxPopups: 4, minDelaySeconds: 1 });
  const [isLoading, setIsLoading] = React.useState(true);
  const refetch = React.useCallback(async () => {
    if (!canAccess) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const res = await authedFetch(`/journeys${cq}`);
      if (!res.ok) return;
      const body = await res.json() as { data: JourneyListItem[]; meta?: { maxPopups: number; minDelaySeconds: number } };
      setJourneys(body.data ?? []);
      if (body.meta) setMeta(body.meta);
    } catch { /* show empty rather than crash */ } finally { setIsLoading(false); }
  }, [canAccess, cq]);
  React.useEffect(() => { void refetch(); }, [refetch]);

  // Campaign options for the Popup nodes. Loaded via authedFetch — the SAME proven path the editor
  // uses for the graph — because the Refine useCustom version returned empty in production, so the
  // dropdown never populated even though the campaigns exist. `cq` scopes to the active client like
  // the rest of the app (empty when "All clients").
  const [campaigns, setCampaigns] = React.useState<CampaignLite[]>(NO_CAMPAIGNS);
  React.useEffect(() => {
    if (!canAccess) return;
    let alive = true;
    (async () => {
      try {
        const res = await authedFetch(`/campaigns?limit=100${cq}`);
        if (!res.ok || !alive) return;
        const body = await res.json() as { data: CampaignLite[] };
        if (alive) setCampaigns(body.data ?? NO_CAMPAIGNS);
      } catch { /* leave the dropdown empty rather than crash */ }
    })();
    return () => { alive = false; };
  }, [canAccess, cq]);

  const createJourney = async () => {
    setBusy(true);
    try {
      const name = `Journey ${journeys.length + 1}`;
      const res = await authedFetch('/journeys', { method: 'POST', body: JSON.stringify({ name }) });
      if (res.ok) { const { data } = await res.json() as { data: { id: string } }; await refetch(); setOpenId(data.id); }
    } finally { setBusy(false); }
  };
  const removeJourney = async (id: string) => {
    if (!confirm('Delete this journey?')) return;
    await authedFetch(`/journeys/${id}`, { method: 'DELETE' });
    await refetch();
  };

  if (!canAccess) {
    return (
      <div style={{ maxWidth: 460, margin: '60px auto', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
        <Lock size={28} style={{ color: 'var(--text-muted)', marginBottom: 14 }} />
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Journeys is on Scale and Agency</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Upgrade to the Scale or Agency plan to chain popups into multi-step, node-based flows.</p>
      </div>
    );
  }

  if (openId) {
    return <ReactFlowProvider><JourneyEditor journeyId={openId} campaigns={campaigns} meta={meta} onClose={() => { setOpenId(null); void refetch(); }} /></ReactFlowProvider>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><GitBranch size={20} /> Journeys</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Node-based flows: trigger → popup → delay/condition/split → goal.</p>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={createJourney} disabled={busy} style={btn('primary')}><Plus size={15} /> New journey</button>
      </div>

      {isLoading ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div> :
        journeys.length === 0 ? (
          <div style={{ border: '1px dashed var(--border-subtle)', borderRadius: 12, padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <GitBranch size={26} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No journeys yet</div>
            <p style={{ fontSize: 13, maxWidth: 400, margin: '6px auto 0' }}>Create a journey to sequence multiple popups with branching, delays, and goals.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
            {journeys.map((j) => (
              <div key={j.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <strong style={{ fontSize: 14 }}>{j.name}</strong>
                  <span style={{ fontSize: 10, fontWeight: 700, color: j.status === 'active' ? '#16a34a' : '#71717a', textTransform: 'uppercase' }}>{j.status}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{j.nodeCount} node{j.nodeCount === 1 ? '' : 's'} · v{j.version}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setOpenId(j.id)} style={{ ...btn('primary'), flex: 1 }}>Open</button>
                  <button onClick={() => removeJourney(j.id)} style={{ ...btn('ghost'), color: '#dc2626' }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
};

// ── small UI helpers ─────────────────────────────────────────────────────────────
// Floating overlay panel surface (toolbar / palette / inspector) layered over the full-bleed canvas.
const floatCard: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12, boxShadow: '0 4px 16px rgba(0,0,0,.18)' };
const inp: React.CSSProperties = { width: '100%', fontSize: 12, padding: '7px 9px', border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-surface)', color: 'var(--text-primary)' };
const Lbl: React.FC<{ children: React.ReactNode }> = ({ children }) => <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>{children}</label>;
const NumRow: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><Lbl>{label}</Lbl><input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} style={inp} /></div>
);
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
    border: kind === 'primary' ? 'none' : '1px solid var(--border-subtle)',
    background: kind === 'primary' ? 'var(--accent, #6366f1)' : 'var(--bg-surface)',
    color: kind === 'primary' ? '#fff' : 'var(--text-primary)',
  };
}
