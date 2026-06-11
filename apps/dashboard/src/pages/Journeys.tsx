import React from 'react';
import { GitBranch, ChevronDown, ChevronRight, Pencil, Lock, AlertCircle, ArrowDown, Link2, Link2Off, ShieldCheck } from 'lucide-react';
import { useCustom, useApiUrl } from '@refinedev/core';
import { useActiveClient } from '../hooks/useClients';
import { usePlan } from '../hooks/usePlan';
import { authedFetch } from '../providers/dataProvider';
import { DesignThumbnail } from '../components/DesignThumbnail';

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

const REASON_LABEL: Record<string, string> = {
  frequency_cap: 'Frequency cap',
  targeting_miss: 'Targeting miss',
  priority_lost: 'Priority lost',
  unknown: 'Other',
};

const ADVANCE_LABEL: Record<Sequence['advanceOn'], string> = {
  dismiss: 'on dismiss',
  convert: 'on convert',
  both: 'on dismiss or convert',
};

const statusBadge = (s: string) =>
  s === 'active' ? 'badge-success' : s === 'paused' ? 'badge-warning' : 'badge-neutral';

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
  const nodes = React.useMemo(
    () => ((journeysResult as { data?: JourneyNode[] } | undefined)?.data ?? []),
    [journeysResult],
  );
  // Runtime guardrails are fixed constants enforced by the snippet's journey.js chunk.
  const maxChain = 2;
  const minDelay = 5;

  // Group nodes into per-site journeys (chaining is same-site only).
  const sites = React.useMemo(() => {
    const bySite = new Map<string, { siteId: string; siteName: string; nodes: JourneyNode[] }>();
    for (const n of nodes) {
      const key = n.siteId ?? '__none__';
      if (!bySite.has(key)) bySite.set(key, { siteId: key, siteName: n.siteName ?? 'Unassigned site', nodes: [] });
      bySite.get(key)!.nodes.push(n);
    }
    return [...bySite.values()];
  }, [nodes]);

  if (!isAgency) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Header />
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
          <Lock size={28} style={{ color: 'var(--text-muted)', marginBottom: 14 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Journeys is an Agency feature</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto' }}>
            Upgrade to the Agency plan to chain your clients' popups into multi-step conversion flows.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Header />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 12px', marginBottom: 20, fontSize: 12, color: 'var(--text-muted)' }}>
        <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1, color: 'var(--status-success)' }} />
        <span>
          Chains are runtime-guarded so they can never trap a visitor: at most <strong>{maxChain}</strong> popups per page load,
          a minimum <strong>{minDelay}s</strong> gap between them, and no campaign repeats. There is no back-button or history manipulation.
        </span>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 10 }} />)}
        </div>
      ) : nodes.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
          <GitBranch size={26} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No campaigns to chain yet</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            {activeClientId ? 'This client has no campaigns yet.' : 'Create a campaign to start a journey.'}
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('/campaigns')}>View campaigns</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {sites.map((site) => (
            <SiteJourney
              key={site.siteId}
              siteName={site.siteName}
              nodes={site.nodes}
              minDelay={minDelay}
              onNavigate={onNavigate}
              onChanged={() => void refetch()}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Header: React.FC = () => (
  <div style={{ marginBottom: 24, paddingBottom: 18, borderBottom: '1px solid var(--border-subtle)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Journeys</h1>
      <span className="badge badge-accent" style={{ fontSize: 9 }}>Agency</span>
    </div>
    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
      Chain a site's popups into a flow — when one is dismissed or converts, the next plays. Edits go live immediately.
    </p>
  </div>
);

// One site = one journey graph. Nodes are ordered by following the chain links (roots first).
const SiteJourney: React.FC<{
  siteName: string;
  nodes: JourneyNode[];
  minDelay: number;
  onNavigate: (p: string) => void;
  onChanged: () => void;
}> = ({ siteName, nodes, minDelay, onNavigate, onChanged }) => {
  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // Ordering: a "root" is a node that nothing else chains TO. Walk each root's chain, then append
  // any leftovers (cycles are guarded at runtime; we just avoid infinite loops here).
  const ordered = React.useMemo(() => {
    const targeted = new Set(nodes.map((n) => n.sequence?.nextCampaignId).filter(Boolean) as string[]);
    const roots = nodes.filter((n) => !targeted.has(n.id));
    const out: JourneyNode[] = [];
    const visited = new Set<string>();
    const walk = (n: JourneyNode) => {
      if (visited.has(n.id)) return;
      visited.add(n.id);
      out.push(n);
      const nxt = n.sequence?.nextCampaignId ? byId.get(n.sequence.nextCampaignId) : undefined;
      if (nxt) walk(nxt);
    };
    (roots.length ? roots : nodes).forEach(walk);
    nodes.forEach((n) => { if (!visited.has(n.id)) { visited.add(n.id); out.push(n); } }); // orphans / cycle tails
    return out;
  }, [nodes, byId]);

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 18px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <GitBranch size={14} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{siteName}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {nodes.length} campaign{nodes.length === 1 ? '' : 's'}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
        {ordered.map((node, i) => {
          const linkedTarget = node.sequence?.nextCampaignId ? byId.get(node.sequence.nextCampaignId) : undefined;
          return (
            <NodeCard
              key={node.id}
              node={node}
              siblings={nodes}
              linkedTargetName={linkedTarget?.name ?? null}
              minDelay={minDelay}
              isLast={i === ordered.length - 1}
              onNavigate={onNavigate}
              onChanged={onChanged}
            />
          );
        })}
      </div>
    </div>
  );
};

const NodeCard: React.FC<{
  node: JourneyNode;
  siblings: JourneyNode[];
  linkedTargetName: string | null;
  minDelay: number;
  isLast: boolean;
  onNavigate: (p: string) => void;
  onChanged: () => void;
}> = ({ node, siblings, linkedTargetName, minDelay, onNavigate, onChanged }) => {
  const [editing, setEditing] = React.useState(false);
  const [diagOpen, setDiagOpen] = React.useState(false);
  const [diag, setDiag] = React.useState<Diagnose | 'loading' | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Link editor draft state.
  const [nextId, setNextId] = React.useState(node.sequence?.nextCampaignId ?? '');
  const [advanceOn, setAdvanceOn] = React.useState<Sequence['advanceOn']>(node.sequence?.advanceOn ?? 'dismiss');
  const [delay, setDelay] = React.useState(node.sequence?.delaySeconds ?? minDelay);

  const linkOptions = siblings.filter((s) => s.id !== node.id);

  const openDiag = async () => {
    setDiagOpen((o) => !o);
    if (diag) return;
    setDiag('loading');
    try {
      const res = await authedFetch(`/journeys/${node.id}/diagnose`);
      const body = await res.json() as { data: Diagnose };
      setDiag(body.data);
    } catch {
      setDiag(null);
    }
  };

  const saveLink = async (clear = false) => {
    setSaving(true);
    try {
      const payload = clear
        ? { nextCampaignId: null }
        : { nextCampaignId: nextId || null, advanceOn, delaySeconds: Math.max(minDelay, delay) };
      const res = await authedFetch(`/journeys/${node.id}/link`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
        alert(err.error?.message ?? 'Could not save the link.');
        return;
      }
      setEditing(false);
      onChanged();
    } catch {
      alert('Could not save the link.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Node card */}
      <div style={{ width: '100%', maxWidth: 520, background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 12, padding: 12 }}>
          <div style={{ width: 96, height: 64, flexShrink: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            <DesignThumbnail config={{}} kind={node.format} height={64} showStatus={false} radius="0" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
              <span className={`badge ${statusBadge(node.status)}`} style={{ fontSize: 9 }}>{node.status}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{node.objective.replace(/_/g, ' ')} · {node.format}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => setEditing((e) => !e)}>
                <Link2 size={12} style={{ marginRight: 4 }} />{node.sequence ? 'Edit link' : 'Add next'}
              </button>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => void openDiag()}>
                {diagOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Live stats
              </button>
              <button className="btn btn-icon btn-sm" title="Open in designer" style={{ marginLeft: 'auto' }} onClick={() => onNavigate(`/campaigns/${node.campaignId}/design`)}>
                <Pencil size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Link editor */}
        {editing && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 12, background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              Then play
              <select value={nextId} onChange={(e) => setNextId(e.target.value)} className="input" style={{ marginTop: 4, width: '100%' }}>
                <option value="">— nothing (end of journey) —</option>
                {linkOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            {nextId && (
              <div style={{ display: 'flex', gap: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, flex: 1 }}>
                  Advance
                  <select value={advanceOn} onChange={(e) => setAdvanceOn(e.target.value as Sequence['advanceOn'])} className="input" style={{ marginTop: 4, width: '100%' }}>
                    <option value="dismiss">on dismiss</option>
                    <option value="convert">on convert</option>
                    <option value="both">on dismiss or convert</option>
                  </select>
                </label>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, width: 110 }}>
                  Delay (s)
                  <input type="number" min={minDelay} max={300} value={delay} onChange={(e) => setDelay(Math.max(minDelay, Math.min(300, parseInt(e.target.value) || minDelay)))} className="input" style={{ marginTop: 4, width: '100%' }} />
                </label>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {node.sequence && (
                <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => void saveLink(true)} style={{ fontSize: 11, color: 'var(--status-danger, #dc2626)' }}>
                  <Link2Off size={12} style={{ marginRight: 4 }} />Remove link
                </button>
              )}
              <button className="btn btn-secondary btn-sm" disabled={saving} onClick={() => setEditing(false)} style={{ fontSize: 11 }}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => void saveLink(false)} style={{ fontSize: 11 }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        )}

        {/* Live diagnostics (real telemetry) */}
        {diagOpen && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 12, background: 'var(--bg-surface)' }}>
            {diag === 'loading' || !diag ? <div className="skeleton" style={{ height: 60 }} /> : <Diag d={diag} />}
          </div>
        )}
      </div>

      {/* Edge to next node */}
      {node.sequence && linkedTargetName && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 0' }}>
          <ArrowDown size={16} style={{ color: 'var(--accent-500, #6366f1)' }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {ADVANCE_LABEL[node.sequence.advanceOn]} · {node.sequence.delaySeconds}s
          </span>
        </div>
      )}
    </div>
  );
};

const Diag: React.FC<{ d: Diagnose }> = ({ d }) => (
  <div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
      {[
        { label: 'Rules eval', value: d.rulesEvaluated.toLocaleString() },
        { label: 'Shown', value: d.fired.toLocaleString() },
        { label: 'Blocked', value: d.blocked.toLocaleString() },
        { label: 'CTR', value: `${(d.ctr * 100).toFixed(1)}%` },
        { label: 'Dismiss', value: `${(d.dismissRate * 100).toFixed(1)}%` },
      ].map((s) => (
        <div key={s.label}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 3 }}>{s.label}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{s.value}</div>
        </div>
      ))}
    </div>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 6 }}>Top block reasons (live)</div>
    {d.topBlockedReasons.length === 0 ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
        <AlertCircle size={13} /> Nothing blocked in the last 30 days.
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {d.topBlockedReasons.map((r) => {
          const pct = d.blocked > 0 ? (r.count / d.blocked) * 100 : 0;
          return (
            <div key={r.reason}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{REASON_LABEL[r.reason] ?? r.reason}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{r.count.toLocaleString()} · {pct.toFixed(0)}%</span>
              </div>
              <div className="usage-bar-track" style={{ height: 5 }}>
                <div className="usage-bar-fill" style={{ width: `${pct}%`, height: '100%', background: 'var(--data-3)' }} />
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
