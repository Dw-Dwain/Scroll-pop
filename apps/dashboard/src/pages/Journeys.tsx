import React from 'react';
import { GitBranch, Lock, AlertCircle, Pencil, Link2Off, ShieldCheck, ZoomIn, ZoomOut, Maximize, X, Crosshair } from 'lucide-react';
import { useCustom, useApiUrl } from '@refinedev/core';
import { useActiveClient } from '../hooks/useClients';
import { usePlan } from '../hooks/usePlan';
import { authedFetch } from '../providers/dataProvider';

interface JourneysProps {
  onNavigate: (path: string) => void;
}

interface Sequence {
  nextCampaignId: string;
  advanceOn: 'dismiss' | 'convert' | 'both';
  delaySeconds: number;
}

interface JourneyNode {
  id: string;
  campaignId: string;
  name: string;
  status: string;
  objective: string;
  format: string;
  siteId: string | null;
  siteName: string | null;
  sequence: Sequence | null;
}

interface Diagnose {
  rulesEvaluated: number;
  fired: number;
  blocked: number;
  topBlockedReasons: { reason: string; count: number }[];
  ctr: number;
  dismissRate: number;
}

const NODE_W = 196;
const NODE_H = 96;
const MIN_DELAY = 5;
const MAX_CHAIN = 2;
const POS_KEY = 'sp_journey_pos_v1';

type Pos = { x: number; y: number };
const loadPos = (): Record<string, Pos> => {
  try { return JSON.parse(localStorage.getItem(POS_KEY) || '{}') as Record<string, Pos>; } catch { return {}; }
};
const savePos = (m: Record<string, Pos>) => { try { localStorage.setItem(POS_KEY, JSON.stringify(m)); } catch { /* ignore */ } };

const statusColor = (s: string) => (s === 'active' ? '#16a34a' : s === 'paused' ? '#d97706' : '#71717a');

export const Journeys: React.FC<JourneysProps> = ({ onNavigate }) => {
  const apiUrl = useApiUrl();
  const plan = usePlan();
  const isAgency = plan.plan === 'agency' || plan.isUnlimited;
  const { activeClientId } = useActiveClient();
  const cq = activeClientId ? `?clientId=${activeClientId}` : '';

  const { data: journeysResult, isLoading, refetch } = useCustom({
    url: `${apiUrl}/journeys${cq}`,
    method: 'get',
    queryOptions: { queryKey: ['journeys', activeClientId], enabled: isAgency },
  });
  const allNodes = React.useMemo(
    () => ((journeysResult as { data?: JourneyNode[] } | undefined)?.data ?? []),
    [journeysResult],
  );

  // Group by site; chaining is same-site only, so the canvas shows one site at a time.
  const sites = React.useMemo(() => {
    const m = new Map<string, { siteId: string; siteName: string; nodes: JourneyNode[] }>();
    for (const n of allNodes) {
      const key = n.siteId ?? '__none__';
      if (!m.has(key)) m.set(key, { siteId: key, siteName: n.siteName ?? 'Unassigned site', nodes: [] });
      m.get(key)!.nodes.push(n);
    }
    return [...m.values()];
  }, [allNodes]);

  const [activeSite, setActiveSite] = React.useState<string | null>(null);
  const siteKey = activeSite ?? sites[0]?.siteId ?? null;
  const site = sites.find((s) => s.siteId === siteKey) ?? sites[0];

  if (!isAgency) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Header />
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <Lock size={28} style={{ color: 'var(--text-muted)', marginBottom: 14 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Journeys is an Agency feature</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto' }}>
            Upgrade to the Agency plan to chain your clients' popups into multi-step flows.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Header />

      {isLoading ? (
        <div className="skeleton" style={{ height: 520, borderRadius: 12 }} />
      ) : allNodes.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <GitBranch size={26} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No campaigns to chain yet</div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => onNavigate('/campaigns')}>View campaigns</button>
        </div>
      ) : (
        <>
          {sites.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Site</span>
              <select value={siteKey ?? ''} onChange={(e) => setActiveSite(e.target.value)} className="input" style={{ maxWidth: 280 }}>
                {sites.map((s) => <option key={s.siteId} value={s.siteId}>{s.siteName} ({s.nodes.length})</option>)}
              </select>
            </div>
          )}
          {site && (
            <JourneyCanvas
              key={site.siteId}
              nodes={site.nodes}
              onNavigate={onNavigate}
              onChanged={() => void refetch()}
            />
          )}
        </>
      )}
    </div>
  );
};

const Header: React.FC = () => (
  <div style={{ marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Journeys</h1>
      <span className="badge badge-accent" style={{ fontSize: 9 }}>Agency</span>
    </div>
    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
      Drag campaigns to arrange them, drag from a node's right dot to another node to chain them. Edits go live immediately.
    </p>
  </div>
);

// ─── The node canvas (pan / zoom / drag / connect) ──────────────────────────────
const JourneyCanvas: React.FC<{
  nodes: JourneyNode[];
  onNavigate: (p: string) => void;
  onChanged: () => void;
}> = ({ nodes, onNavigate, onChanged }) => {
  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // Node positions (persisted in localStorage). Auto-layout any node without a saved position.
  const [pos, setPos] = React.useState<Record<string, Pos>>(() => {
    const saved = loadPos();
    const next = { ...saved };
    nodes.forEach((n, i) => {
      if (!next[n.id]) next[n.id] = { x: 60 + (i % 3) * (NODE_W + 90), y: 50 + Math.floor(i / 3) * (NODE_H + 80) };
    });
    return next;
  });
  const posRef = React.useRef(pos);
  posRef.current = pos;

  const [pan, setPan] = React.useState<Pos>({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [linkFrom, setLinkFrom] = React.useState<string | null>(null);
  const [diag, setDiag] = React.useState<Record<string, Diagnose | 'loading'>>({});

  const drag = React.useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const panning = React.useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  // Global mouse handlers for drag + pan.
  React.useEffect(() => {
    const move = (e: MouseEvent) => {
      if (drag.current) {
        const d = drag.current;
        setPos((p) => ({ ...p, [d.id]: { x: d.ox + (e.clientX - d.sx) / zoom, y: d.oy + (e.clientY - d.sy) / zoom } }));
      } else if (panning.current) {
        const pn = panning.current;
        setPan({ x: pn.ox + (e.clientX - pn.sx), y: pn.oy + (e.clientY - pn.sy) });
      }
    };
    const up = () => {
      if (drag.current) { savePos(posRef.current); drag.current = null; }
      panning.current = null;
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [zoom]);

  const startNodeDrag = (e: React.MouseEvent, id: string) => {
    if (linkFrom) return; // in linking mode, clicks connect instead of drag
    e.stopPropagation();
    const p = pos[id] ?? { x: 0, y: 0 };
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y };
    setSelected(id);
  };

  const onNodeClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (linkFrom && linkFrom !== id) { void saveLink(linkFrom, id); setLinkFrom(null); return; }
    setSelected(id);
  };

  const saveLink = async (fromId: string, nextId: string | null, advanceOn: Sequence['advanceOn'] = 'dismiss', delaySeconds = MIN_DELAY) => {
    try {
      const res = await authedFetch(`/journeys/${fromId}/link`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextId ? { nextCampaignId: nextId, advanceOn, delaySeconds } : { nextCampaignId: null }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})) as { error?: { message?: string } }; alert(b.error?.message ?? 'Could not save link.'); return; }
      onChanged();
    } catch { alert('Could not save link.'); }
  };

  const openDiag = async (id: string) => {
    if (diag[id]) return;
    setDiag((d) => ({ ...d, [id]: 'loading' }));
    try {
      const res = await authedFetch(`/journeys/${id}/diagnose`);
      const b = await res.json() as { data: Diagnose };
      setDiag((d) => ({ ...d, [id]: b.data }));
    } catch { setDiag((d) => { const n = { ...d }; delete n[id]; return n; }); }
  };

  const fit = () => { setPan({ x: 0, y: 0 }); setZoom(1); };

  const selNode = selected ? byId.get(selected) : undefined;
  const chainCount = nodes.filter((n) => n.sequence).length;

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      {/* Canvas */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderTopLeftRadius: 10, borderTopRightRadius: 10, padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)' }}>
          <ShieldCheck size={13} style={{ color: 'var(--status-success)' }} />
          <span>Guarded: max {MAX_CHAIN} chained / load · ≥{MIN_DELAY}s gap · no repeats. {chainCount} link{chainCount === 1 ? '' : 's'} set.</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button className="btn btn-icon btn-sm" title="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}><ZoomOut size={13} /></button>
            <button className="btn btn-icon btn-sm" title="Zoom in" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}><ZoomIn size={13} /></button>
            <button className="btn btn-icon btn-sm" title="Reset view" onClick={fit}><Maximize size={13} /></button>
          </div>
        </div>

        {linkFrom && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-50, #eef2ff)', border: '1px solid var(--accent-300, #c7d2fe)', padding: '5px 10px', fontSize: 11, color: 'var(--accent-700, #4338ca)' }}>
            <Crosshair size={13} /> Click a target campaign to chain <strong>{byId.get(linkFrom)?.name}</strong> into it.
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', fontSize: 10 }} onClick={() => setLinkFrom(null)}>Cancel</button>
          </div>
        )}

        <div
          onMouseDown={(e) => { panning.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y }; setSelected(null); if (linkFrom) setLinkFrom(null); }}
          onWheel={(e) => { setZoom((z) => Math.min(1.6, Math.max(0.4, z * (e.deltaY < 0 ? 1.08 : 0.92)))); }}
          style={{
            position: 'relative', height: 560, overflow: 'hidden', cursor: panning.current ? 'grabbing' : 'grab',
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderTop: 'none',
            borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
            backgroundImage: 'radial-gradient(var(--border-subtle) 1px, transparent 0)', backgroundSize: '22px 22px',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
            {/* Edges */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: 4000, height: 3000, overflow: 'visible', pointerEvents: 'none' }}>
              <defs>
                <marker id="jarrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L7,3 L0,6 Z" fill="var(--accent-500, #6366f1)" />
                </marker>
              </defs>
              {nodes.map((n) => {
                if (!n.sequence) return null;
                const t = byId.get(n.sequence.nextCampaignId);
                const a = pos[n.id]; const b = t ? pos[t.id] : undefined;
                if (!t || !a || !b) return null;
                const sx = a.x + NODE_W, sy = a.y + NODE_H / 2;
                const tx = b.x, ty = b.y + NODE_H / 2;
                const dx = Math.max(40, Math.abs(tx - sx) / 2);
                return <path key={n.id} d={`M${sx},${sy} C${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`} fill="none" stroke="var(--accent-500, #6366f1)" strokeWidth={2} markerEnd="url(#jarrow)" />;
              })}
            </svg>

            {/* Edge labels (HTML, clickable) */}
            {nodes.map((n) => {
              if (!n.sequence) return null;
              const t = byId.get(n.sequence.nextCampaignId);
              const a = pos[n.id]; const b = t ? pos[t.id] : undefined;
              if (!t || !a || !b) return null;
              const mx = (a.x + NODE_W + b.x) / 2, my = (a.y + b.y) / 2 + NODE_H / 2;
              return (
                <div key={`lbl-${n.id}`} style={{ position: 'absolute', left: mx - 50, top: my - 11, width: 100, display: 'flex', justifyContent: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '1px 7px', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                    {n.sequence.advanceOn === 'both' ? 'dismiss/convert' : n.sequence.advanceOn} · {n.sequence.delaySeconds}s
                    <button title="Remove link" onClick={(e) => { e.stopPropagation(); void saveLink(n.id, null); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--status-danger,#dc2626)', display: 'flex', padding: 0 }}><X size={10} /></button>
                  </span>
                </div>
              );
            })}

            {/* Nodes */}
            {nodes.map((n) => {
              const p = pos[n.id] ?? { x: 0, y: 0 };
              const isSel = selected === n.id;
              const isLinkSrc = linkFrom === n.id;
              return (
                <div
                  key={n.id}
                  onMouseDown={(e) => startNodeDrag(e, n.id)}
                  onClick={(e) => onNodeClick(e, n.id)}
                  style={{
                    position: 'absolute', left: p.x, top: p.y, width: NODE_W, height: NODE_H,
                    background: 'var(--bg-raised)', border: `1.5px solid ${isSel ? 'var(--accent-500,#6366f1)' : isLinkSrc ? 'var(--status-warning,#d97706)' : 'var(--border-subtle)'}`,
                    borderRadius: 10, boxShadow: isSel ? '0 4px 16px rgba(99,102,241,0.18)' : '0 1px 4px rgba(0,0,0,0.08)',
                    cursor: linkFrom ? 'pointer' : 'grab', userSelect: 'none', padding: 10, boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: statusColor(n.status), flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.name}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{n.objective.replace(/_/g, ' ')} · {n.format}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{n.status}</div>

                  {/* input port */}
                  <span style={{ position: 'absolute', left: -6, top: NODE_H / 2 - 6, width: 12, height: 12, borderRadius: 99, background: 'var(--bg-surface)', border: '2px solid var(--text-muted)' }} />
                  {/* output port — drag/click to start a link */}
                  <span
                    title="Drag/click to chain to another campaign"
                    onMouseDown={(e) => { e.stopPropagation(); setLinkFrom(n.id); }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', right: -7, top: NODE_H / 2 - 7, width: 14, height: 14, borderRadius: 99, background: isLinkSrc ? 'var(--status-warning,#d97706)' : 'var(--accent-500,#6366f1)', border: '2px solid var(--bg-surface)', cursor: 'crosshair' }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Inspector */}
      <div style={{ width: 280, flexShrink: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14, minHeight: 200 }}>
        {!selNode ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', paddingTop: 30 }}>
            <GitBranch size={20} style={{ marginBottom: 8, opacity: 0.6 }} />
            <div>Select a node to edit its step, or drag from a node's right dot to chain it.</div>
          </div>
        ) : (
          <Inspector
            node={selNode}
            siblings={nodes}
            diag={diag[selNode.id]}
            onOpenDiag={() => void openDiag(selNode.id)}
            onSaveLink={(nextId, adv, delay) => void saveLink(selNode.id, nextId, adv, delay)}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </div>
  );
};

const Inspector: React.FC<{
  node: JourneyNode;
  siblings: JourneyNode[];
  diag: Diagnose | 'loading' | undefined;
  onOpenDiag: () => void;
  onSaveLink: (nextId: string | null, advanceOn: Sequence['advanceOn'], delay: number) => void;
  onNavigate: (p: string) => void;
}> = ({ node, siblings, diag, onOpenDiag, onSaveLink, onNavigate }) => {
  const [nextId, setNextId] = React.useState(node.sequence?.nextCampaignId ?? '');
  const [advanceOn, setAdvanceOn] = React.useState<Sequence['advanceOn']>(node.sequence?.advanceOn ?? 'dismiss');
  const [delay, setDelay] = React.useState(node.sequence?.delaySeconds ?? MIN_DELAY);
  React.useEffect(() => {
    setNextId(node.sequence?.nextCampaignId ?? '');
    setAdvanceOn(node.sequence?.advanceOn ?? 'dismiss');
    setDelay(node.sequence?.delaySeconds ?? MIN_DELAY);
  }, [node.id, node.sequence]);

  const opts = siblings.filter((s) => s.id !== node.id);

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, wordBreak: 'break-word' }}>{node.name}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 12 }}>{node.objective.replace(/_/g, ' ')} · {node.format} · {node.status}</div>

      <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Then play</label>
      <select value={nextId} onChange={(e) => setNextId(e.target.value)} className="input" style={{ width: '100%', marginTop: 4, marginBottom: 10 }}>
        <option value="">— nothing (end) —</option>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>

      {nextId && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>Advance</label>
            <select value={advanceOn} onChange={(e) => setAdvanceOn(e.target.value as Sequence['advanceOn'])} className="input" style={{ width: '100%', marginTop: 4 }}>
              <option value="dismiss">on dismiss</option>
              <option value="convert">on convert</option>
              <option value="both">on either</option>
            </select>
          </div>
          <div style={{ width: 84 }}>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>Delay s</label>
            <input type="number" min={MIN_DELAY} max={300} value={delay} onChange={(e) => setDelay(Math.max(MIN_DELAY, Math.min(300, parseInt(e.target.value) || MIN_DELAY)))} className="input" style={{ width: '100%', marginTop: 4 }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={() => onSaveLink(nextId || null, advanceOn, delay)}>Save</button>
        {node.sequence && (
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--status-danger,#dc2626)' }} onClick={() => onSaveLink(null, advanceOn, delay)}>
            <Link2Off size={12} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border-subtle)', paddingTop: 10, marginBottom: 10 }}>
        <button className="btn btn-secondary btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={() => onNavigate(`/campaigns/${node.campaignId}/design`)}>
          <Pencil size={12} style={{ marginRight: 4 }} /> Design
        </button>
        <button className="btn btn-secondary btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={onOpenDiag}>Live stats</button>
      </div>

      {diag === 'loading' ? <div className="skeleton" style={{ height: 50 }} /> : diag ? <DiagBlock d={diag} /> : null}
    </div>
  );
};

const REASON_LABEL: Record<string, string> = { frequency_cap: 'Frequency cap', targeting_miss: 'Targeting miss', priority_lost: 'Priority lost', unknown: 'Other' };
const DiagBlock: React.FC<{ d: Diagnose }> = ({ d }) => (
  <div style={{ background: 'var(--bg-raised)', borderRadius: 8, padding: 10 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 8 }}>
      {[
        { l: 'Shown', v: d.fired.toLocaleString() },
        { l: 'Blocked', v: d.blocked.toLocaleString() },
        { l: 'CTR', v: `${(d.ctr * 100).toFixed(1)}%` },
        { l: 'Dismiss', v: `${(d.dismissRate * 100).toFixed(1)}%` },
      ].map((s) => (
        <div key={s.l}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{s.l}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{s.v}</div>
        </div>
      ))}
    </div>
    {d.topBlockedReasons.length === 0 ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}><AlertCircle size={12} /> Nothing blocked (30d).</div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {d.topBlockedReasons.map((r) => (
          <div key={r.reason} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{REASON_LABEL[r.reason] ?? r.reason}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{r.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);
