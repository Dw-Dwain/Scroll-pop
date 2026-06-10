import React from 'react';
import { GitBranch, ChevronDown, ChevronRight, Pencil, Lock, AlertCircle } from 'lucide-react';
import { useCustom, useApiUrl } from '@refinedev/core';
import { useActiveClient } from '../hooks/useClients';
import { usePlan } from '../hooks/usePlan';
import { authedFetch } from '../providers/dataProvider';

interface JourneysProps {
  onNavigate: (path: string) => void;
}

interface Journey {
  id: string;
  campaignId: string;
  name: string;
  status: string;
  objective: string;
  format: string;
  siteId: string | null;
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

const statusBadge = (s: string) =>
  s === 'active' ? 'badge-success' : s === 'paused' ? 'badge-warning' : 'badge-neutral';

export const Journeys: React.FC<JourneysProps> = ({ onNavigate }) => {
  const apiUrl = useApiUrl();
  const plan = usePlan();
  const isAgency = plan.plan === 'agency' || plan.isUnlimited;
  const { activeClientId } = useActiveClient();
  const cq = activeClientId ? `?clientId=${activeClientId}` : '';

  const { data: journeysResult, isLoading } = useCustom({
    url: `${apiUrl}/journeys${cq}`,
    method: 'get',
    queryOptions: { queryKey: ['journeys', activeClientId], enabled: isAgency },
  });
  const journeys = ((journeysResult as { data?: Journey[] } | undefined)?.data ?? []);

  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [diag, setDiag] = React.useState<Record<string, Diagnose | 'loading'>>({});

  const toggle = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!diag[id]) {
      setDiag((d) => ({ ...d, [id]: 'loading' }));
      try {
        const res = await authedFetch(`/journeys/${id}/diagnose`);
        const body = await res.json() as { data: Diagnose };
        setDiag((d) => ({ ...d, [id]: body.data }));
      } catch {
        setDiag((d) => { const n = { ...d }; delete n[id]; return n; });
      }
    }
  };

  if (!isAgency) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Header />
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
          <Lock size={28} style={{ color: 'var(--text-muted)', marginBottom: 14 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Journeys is an Agency feature</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto' }}>
            Upgrade to the Agency plan to map and diagnose your clients' multi-step conversion flows.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <Header />
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />)}
        </div>
      ) : journeys.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
          <GitBranch size={26} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No journeys yet</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            {activeClientId ? 'This client has no campaigns yet.' : 'Create a campaign to start a journey.'}
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('/campaigns')}>View campaigns</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {journeys.map((j) => {
            const open = expanded === j.id;
            const d = diag[j.id];
            return (
              <div key={j.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                <div
                  onClick={() => void toggle(j.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
                >
                  {open ? <ChevronDown size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {j.objective.replace(/_/g, ' ')} · {j.format}
                    </div>
                  </div>
                  <span className={`badge ${statusBadge(j.status)}`} style={{ fontSize: 9 }}>{j.status}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onNavigate(`/campaigns/${j.campaignId}/design`); }}
                    className="btn btn-icon" title="Edit journey" style={{ flexShrink: 0 }}
                  >
                    <Pencil size={13} />
                  </button>
                </div>
                {open && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 16px', background: 'var(--bg-raised)' }}>
                    {d === 'loading' || !d ? (
                      <div className="skeleton" style={{ height: 72 }} />
                    ) : (
                      <Diag d={d} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Header: React.FC = () => (
  <div style={{ marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid var(--border-subtle)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Journeys</h1>
      <span className="badge badge-accent" style={{ fontSize: 9 }}>Agency</span>
    </div>
    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
      Diagnose how each campaign fires and where it gets blocked — live, per client.
    </p>
  </div>
);

const Diag: React.FC<{ d: Diagnose }> = ({ d }) => (
  <div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
      {[
        { label: 'Rules evaluated', value: d.rulesEvaluated.toLocaleString() },
        { label: 'Shown', value: d.fired.toLocaleString() },
        { label: 'Blocked', value: d.blocked.toLocaleString() },
        { label: 'CTR', value: `${(d.ctr * 100).toFixed(1)}%` },
        { label: 'Dismiss rate', value: `${(d.dismissRate * 100).toFixed(1)}%` },
      ].map((s) => (
        <div key={s.label}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 3 }}>{s.label}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{s.value}</div>
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
