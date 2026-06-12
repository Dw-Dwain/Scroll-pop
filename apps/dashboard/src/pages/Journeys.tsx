import React from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, Handle, Position,
  type Node, type Edge, type Connection, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, ArrowLeft, Rocket, Save, Trash2, Lock, Flag, MousePointerClick, Clock, GitBranch, Split, Target } from 'lucide-react';
import { useCustom, useApiUrl } from '@refinedev/core';
import { usePlan } from '../hooks/usePlan';
import { useActiveClient } from '../hooks/useClients';
import { authedFetch } from '../providers/dataProvider';

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
interface JourneyGraph {
  id: string; name: string; description: string | null; siteId: string | null;
  status: string; startsAt: string | null; endsAt: string | null; version: number;
  nodes: ApiNode[]; edges: ApiEdge[];
}
interface CampaignLite { id: string; name: string; status: string; siteId: string | null }

type NodeData = { kind: NodeType; campaignId?: string | null; config: Record<string, unknown>; campaignName?: string };
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
      {meta.hasOut && <Handle type="source" position={Position.Bottom} style={{ background: meta.color }} />}
    </div>
  );
};
const nodeTypes = { sp: SpNodeView };

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

  // Load the graph.
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const res = await authedFetch(`/journeys/${journeyId}`);
      if (!res.ok || !alive) return;
      const { data } = await res.json() as { data: JourneyGraph };
      setJourney(data);
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
      setStatus(res.ok ? { kind: 'ok', msg: 'Saved' } : { kind: 'err', msg: 'Save failed' });
    } finally { setSaving(false); }
  };

  const publish = async () => {
    setSaving(true); setStatus(null);
    try {
      await authedFetch(`/journeys/${journeyId}/graph`, { method: 'PUT', body: JSON.stringify(toGraph()) }); // save first
      const res = await authedFetch(`/journeys/${journeyId}/publish`, { method: 'POST' });
      if (res.ok) { setStatus({ kind: 'ok', msg: 'Published — live' }); return; }
      const body = await res.json().catch(() => null) as { error?: { details?: string[]; message?: string } } | null;
      const details = body?.error?.details;
      setStatus({ kind: 'err', msg: details?.length ? details.join(' · ') : (body?.error?.message || 'Publish failed') });
    } finally { setSaving(false); }
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
          <Background /><Controls /><MiniMap pannable zoomable />
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
          {status && <span style={{ fontSize: 12, color: status.kind === 'ok' ? '#16a34a' : '#dc2626', maxWidth: 280, textAlign: 'right' }}>{status.msg}</span>}
          <button onClick={save} disabled={saving} style={btn('ghost')}><Save size={14} /> Save</button>
          <button onClick={publish} disabled={saving} style={btn('primary')}><Rocket size={14} /> Publish</button>
        </div>
      </div>

      {/* Floating palette (left) */}
      <div style={{ ...floatCard, position: 'absolute', top: 64, left: 12, width: 150, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'calc(100% - 88px)', overflowY: 'auto', zIndex: 5 }}>
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
      <div style={{ ...floatCard, position: 'absolute', top: 64, right: 12, width: 264, maxHeight: 'calc(100% - 88px)', overflowY: 'auto', zIndex: 5 }}>
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
  const apiUrl = useApiUrl();
  const plan = usePlan();
  const canAccess = plan.meetsMinPlan('scale'); // Journeys: Scale + Agency (and unlimited admins)
  const { activeClientId } = useActiveClient();
  const cq = activeClientId ? `?clientId=${activeClientId}` : '';
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const { data: listRes, isLoading, refetch } = useCustom<{ data: JourneyListItem[]; meta: { maxPopups: number; minDelaySeconds: number } }>({
    url: `${apiUrl}/journeys${cq}`, method: 'get', queryOptions: { queryKey: ['journeys', activeClientId], enabled: canAccess },
  });
  const journeys = listRes?.data?.data ?? [];
  const meta = listRes?.data?.meta ?? { maxPopups: 4, minDelaySeconds: 5 };

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
