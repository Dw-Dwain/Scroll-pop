import React from 'react';
import { FlaskConical, Trophy, Lock, ArrowRight, CheckCircle2, Sparkles, Pause, Play, X } from 'lucide-react';
import { useActiveClient } from '../hooks/useClients';
import { usePlan } from '../hooks/usePlan';
import { authedFetch } from '../providers/dataProvider';
import { DesignThumbnail } from '../components/DesignThumbnail';

interface ExperimentsProps {
  onNavigate: (path: string) => void;
}

interface Campaign { id: string; name: string; status: string }
interface Variant { id: string; name: string; weight: number; config?: Record<string, unknown> }
interface VariantResultRow {
  variantId: string; name?: string; weight?: number;
  impressions: number; clicks: number; conversions: number; conversionRate: number;
  confidence?: number; isSignificant?: boolean; upliftPct?: number; isWinner?: boolean;
}
type AbObjective = 'ctr' | 'conversion';
type AbMode = 'manual' | 'bandit';
type AbStatus = 'running' | 'paused';
interface ExperimentResults {
  variants: VariantResultRow[];
  decided: boolean;
  winnerVariantId: string | null;
  objective?: AbObjective;
  mode?: AbMode;
  status?: AbStatus;
  lastBalancedAt?: string | null;
}
interface ExpData { variants: Variant[]; results: ExperimentResults }

const statusBadge = (s: string) =>
  s === 'active' ? 'badge-success' : s === 'paused' ? 'badge-warning' : 'badge-neutral';

export const Experiments: React.FC<ExperimentsProps> = ({ onNavigate }) => {
  const plan = usePlan();
  const canAccess = plan.meetsMinPlan('agency'); // Experiments: Agency (and unlimited admins)
  const { activeClientId } = useActiveClient();
  const cq = activeClientId ? `&clientId=${activeClientId}` : '';

  // Campaigns load via authedFetch (the proven path). The Refine useCustom version returned empty
  // in production, so the page showed only the "View campaigns" empty state with no experiments.
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  React.useEffect(() => {
    if (!canAccess) { setIsLoading(false); return; }
    let alive = true;
    setIsLoading(true);
    (async () => {
      try {
        const res = await authedFetch(`/campaigns?limit=100${cq}`);
        if (!res.ok || !alive) return;
        const body = await res.json() as { data: Campaign[] };
        if (alive) setCampaigns(body.data ?? []);
      } catch { /* leave empty */ }
      finally { if (alive) setIsLoading(false); }
    })();
    return () => { alive = false; };
  }, [canAccess, cq]);

  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Record<string, ExpData | 'loading'>>({});
  const [creating, setCreating] = React.useState<string | null>(null);

  const loadCampaign = React.useCallback(async (id: string) => {
    setData((d) => ({ ...d, [id]: 'loading' }));
    try {
      const [vRes, rRes] = await Promise.all([
        authedFetch(`/variants?campaignId=${id}`),
        authedFetch(`/variants/results?campaignId=${id}`),
      ]);
      const vBody = await vRes.json() as { data: Variant[] };
      const rBody = await rRes.json() as { data: ExperimentResults };
      setData((d) => ({ ...d, [id]: { variants: vBody.data ?? [], results: rBody.data ?? { variants: [], decided: false, winnerVariantId: null } } }));
    } catch {
      setData((d) => { const n = { ...d }; delete n[id]; return n; });
    }
  }, []);

  const createVariant = async (campaignId: string) => {
    setCreating(campaignId);
    try {
      const res = await authedFetch(`/variants`, { method: 'POST', body: JSON.stringify({ campaignId }) });
      if (!res.ok) { alert('Could not create the variant.'); return; }
      const body = await res.json() as { data: { id: string } };
      onNavigate(`/campaigns/${campaignId}/design?variant=${body.data.id}`);
    } catch { alert('Could not create the variant.'); }
    finally { setCreating(null); }
  };

  const promote = async (campaignId: string, variantId: string) => {
    if (!confirm('Promote this variant to 100% of traffic? The other variants stop showing, and auto-optimize turns off.')) return;
    const res = await authedFetch(`/variants/promote`, { method: 'POST', body: JSON.stringify({ campaignId, variantId }) });
    if (res.ok) await loadCampaign(campaignId);
    else alert('Could not promote the winner.');
  };

  // Update A/B experiment settings (objective / bandit mode / pause). Re-loads results after.
  const setExperiment = async (campaignId: string, patch: { mode?: AbMode; objective?: AbObjective; status?: AbStatus }) => {
    const res = await authedFetch(`/variants/experiment`, { method: 'PUT', body: JSON.stringify({ campaignId, ...patch }) });
    if (res.ok) await loadCampaign(campaignId);
    else alert('Could not update the experiment settings.');
  };

  const toggle = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!data[id]) await loadCampaign(id);
  };

  if (!canAccess) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Header />
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
          <Lock size={28} style={{ color: 'var(--text-muted)', marginBottom: 14 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Experiments is on Scale and Agency</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto' }}>
            Upgrade to the Scale or Agency plan to run and compare A/B experiments.
          </p>
        </div>
      </div>
    );
  }

  const selectedCampaign = expanded ? campaigns.find((c) => c.id === expanded) : undefined;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Header />
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 10 }} />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
          <FlaskConical size={26} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No campaigns to experiment on</div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => onNavigate('/campaigns')}>View campaigns</button>
        </div>
      ) : (
        <>
          {/* Campaign card grid (mirrors Sites/Campaigns) — clean & easy to scan */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {campaigns.map((c) => {
              const isSelected = expanded === c.id;
              const d = data[c.id];
              const loaded = !!d && d !== 'loading';
              const vCount = loaded ? d.variants.length : null;
              const decided = loaded ? d.results.decided : false;
              return (
                <div
                  key={c.id}
                  onClick={() => void toggle(c.id)}
                  style={{
                    background: 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? 'var(--accent-400)' : 'var(--border-subtle)'}`,
                    borderRadius: 10,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (isSelected) return;
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    (e.currentTarget as HTMLElement).style.borderColor = isSelected ? 'var(--accent-400)' : 'var(--border-subtle)';
                  }}
                >
                  {/* Header: name + status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <FlaskConical size={15} style={{ color: 'var(--accent-500, #6366f1)', flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                    </div>
                    <span className={`badge ${statusBadge(c.status)}`} style={{ fontSize: 9, flexShrink: 0 }}>{c.status}</span>
                  </div>

                  {/* Body: A/B summary */}
                  <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {vCount == null ? 'A/B experiment' : vCount < 2 ? 'No A/B test yet' : `${vCount} variants`}
                    </div>
                    {loaded && (vCount ?? 0) >= 2 && (
                      <span style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: decided ? 'rgba(34,197,94,0.1)' : 'var(--bg-raised)', color: decided ? 'var(--status-success)' : 'var(--text-muted)' }}>
                        {decided ? <><Trophy size={11} /> Significant winner</> : 'Running — no winner yet'}
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-raised)' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); void toggle(c.id); }}
                      className="btn btn-sm btn-secondary"
                      style={{ flex: 1, justifyContent: 'center', gap: 5, fontSize: 11 }}
                    >
                      {isSelected ? 'Hide A/B test' : (vCount != null && vCount < 2 ? 'Set up A/B test' : 'View A/B test')}
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected campaign: A/B detail (full width, below the grid) */}
          {expanded && (
            <div style={{ marginTop: 20 }}>
              {data[expanded] === 'loading' || !data[expanded] ? (
                <div className="skeleton" style={{ height: 220, borderRadius: 10 }} />
              ) : (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <FlaskConical size={16} style={{ color: 'var(--accent-500, #6366f1)', flexShrink: 0 }} />
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedCampaign?.name}</span>
                      <span className={`badge ${statusBadge(selectedCampaign?.status ?? '')}`} style={{ fontSize: 9, flexShrink: 0 }}>{selectedCampaign?.status}</span>
                    </div>
                    <button className="btn btn-icon" title="Close" onClick={() => setExpanded(null)}><X size={14} /></button>
                  </div>
                  <ExpResults
                    data={data[expanded] as ExpData}
                    creating={creating === expanded}
                    onCreate={() => void createVariant(expanded)}
                    onManage={() => onNavigate(`/campaigns/detail/${expanded}`)}
                    onPromote={(variantId) => void promote(expanded, variantId)}
                    onSetExperiment={(patch) => void setExperiment(expanded, patch)}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const Header: React.FC = () => (
  <div style={{ marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid var(--border-subtle)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Experiments</h1>
      <span className="badge badge-accent" style={{ fontSize: 9 }}>Scale · Agency</span>
    </div>
    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
      Live A/B experiments with statistical significance — promote the winner when the data is conclusive.
    </p>
  </div>
);

const pct = (n: number | undefined, d = 1) => n === undefined ? '—' : (n * 100).toFixed(d) + '%';

const fmtAgo = (iso?: string | null): string => {
  if (!iso) return 'not yet';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const ExpResults: React.FC<{ data: ExpData; creating: boolean; onCreate: () => void; onManage: () => void; onPromote: (variantId: string) => void; onSetExperiment: (patch: { mode?: AbMode; objective?: AbObjective; status?: AbStatus }) => void }> = ({ data, creating, onCreate, onManage, onPromote, onSetExperiment }) => {
  const { variants, results } = data;
  const byId = new Map(results.variants.map((r) => [r.variantId, r]));
  const objective: AbObjective = results.objective ?? 'ctr';
  const mode: AbMode = results.mode ?? 'manual';
  const status: AbStatus = results.status ?? 'running';
  const banditOn = mode === 'bandit';
  const rateLabel = objective === 'conversion' ? 'CVR' : 'CTR';
  const winnerRow = results.winnerVariantId ? byId.get(results.winnerVariantId) : undefined;

  if (variants.length < 2) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          No A/B test yet — this campaign serves a single design. Create a variant B and edit it to test a different design head-to-head.
        </span>
        <button className="btn btn-primary btn-sm" disabled={creating} onClick={onCreate} style={{ flexShrink: 0 }}>
          {creating ? 'Creating…' : <>Create A/B test <ArrowRight size={12} style={{ marginLeft: 4 }} /></>}
        </button>
      </div>
    );
  }

  const allIdentical = variants.length >= 2 &&
    variants.every((v) => JSON.stringify(v.config ?? {}) === JSON.stringify(variants[0]?.config ?? {}));
  const winnerId = results.winnerVariantId;
  const letter = (i: number) => String.fromCharCode(65 + i);

  return (
    <div>
      {/* Optimization controls — objective + Thompson-sampling auto-optimize + pause/resume */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14, padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Sparkles size={14} style={{ color: banditOn ? 'var(--accent-500, #6366f1)' : 'var(--text-muted)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Auto-optimize</span>
        </div>
        <button
          className={`btn btn-sm ${banditOn ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => onSetExperiment({ mode: banditOn ? 'manual' : 'bandit' })}
          title="Thompson-sampling bandit — automatically shifts traffic toward the better variant. Off = manual weights."
        >
          {banditOn ? 'On' : 'Off'}
        </button>

        <span style={{ width: 1, height: 18, background: 'var(--border-subtle)' }} />

        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Goal</span>
        <select
          value={objective}
          onChange={(e) => onSetExperiment({ objective: e.target.value as AbObjective })}
          style={{ fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-raised)', color: 'var(--text-primary)' }}
        >
          <option value="ctr">Click-through rate</option>
          <option value="conversion">Conversion rate</option>
        </select>

        {banditOn && (
          <>
            <span style={{ width: 1, height: 18, background: 'var(--border-subtle)' }} />
            <button className="btn btn-secondary btn-sm" onClick={() => onSetExperiment({ status: status === 'paused' ? 'running' : 'paused' })}>
              {status === 'paused' ? <><Play size={12} style={{ marginRight: 4 }} />Resume</> : <><Pause size={12} style={{ marginRight: 4 }} />Pause</>}
            </button>
            <span style={{ fontSize: 11, color: status === 'paused' ? 'var(--status-warning)' : 'var(--text-muted)', marginLeft: 'auto' }}>
              {status === 'paused' ? 'Paused — weights frozen' : `Auto-optimized ${fmtAgo(results.lastBalancedAt)}`}
            </span>
          </>
        )}
      </div>

      {allIdentical && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-raised)', border: '1px solid var(--status-warning)', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          <span>⚠️ All variants share the same design, so there's nothing to compare yet. Edit a variant to make it different.</span>
          <button className="btn btn-secondary btn-sm" onClick={onManage} style={{ marginLeft: 'auto', flexShrink: 0 }}>Edit variants</button>
        </div>
      )}

      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 8 }}>
        Variant designs (live)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(variants.length, 3)}, 1fr)`, gap: 10, marginBottom: 16 }}>
        {variants.map((v, i) => {
          const isWinner = v.id === winnerId;
          return (
            <div key={v.id} style={{ border: `1px solid ${isWinner ? 'var(--status-success)' : 'var(--border-subtle)'}`, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-surface)' }}>
              <DesignThumbnail config={(v.config ?? {}) as Record<string, unknown>} height={120} showStatus={false} radius="0" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 9px', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--accent-500, #6366f1)' }}>{letter(i)}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: isWinner ? 600 : 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</span>
                {isWinner && <Trophy size={12} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{v.weight}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(5, 1fr)', gap: 8, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
        <span>Variant</span><span style={{ textAlign: 'right' }}>Reach</span><span style={{ textAlign: 'right' }}>{rateLabel}</span><span style={{ textAlign: 'right' }}>Uplift</span><span style={{ textAlign: 'right' }}>Confidence</span><span style={{ textAlign: 'right' }}>Sig.</span>
      </div>
      {variants.map((v) => {
        const r = byId.get(v.id);
        const isWinner = v.id === winnerId;
        return (
          <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(5, 1fr)', gap: 8, fontSize: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-primary)', fontWeight: isWinner ? 600 : 400 }}>
              {isWinner && <Trophy size={12} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />}
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</span>
            </span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{r ? r.impressions.toLocaleString() : '0'}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: isWinner ? 'var(--status-success)' : 'var(--text-primary)' }}>{pct(r?.conversionRate)}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: (r?.upliftPct ?? 0) > 0 ? 'var(--status-success)' : (r?.upliftPct ?? 0) < 0 ? 'var(--status-error, #dc2626)' : 'var(--text-muted)' }}>{r?.upliftPct === undefined ? '—' : (r.upliftPct > 0 ? '+' : '') + r.upliftPct.toFixed(1) + '%'}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{r?.confidence === undefined ? 'control' : pct(r.confidence, 0)}</span>
            <span style={{ textAlign: 'right' }}>{r?.isSignificant ? <CheckCircle2 size={13} style={{ color: 'var(--status-success)' }} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</span>
          </div>
        );
      })}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 12 }}>
        <span style={{ fontSize: 11, color: results.decided ? 'var(--status-success)' : 'var(--text-muted)' }}>
          {results.decided && winnerRow
            ? `✓ ${winnerRow.name ?? 'Winner'} is a significant winner — ${pct(winnerRow.confidence, 0)} confidence${winnerRow.upliftPct !== undefined ? `, ${winnerRow.upliftPct > 0 ? '+' : ''}${winnerRow.upliftPct.toFixed(1)}% ${rateLabel}` : ''}.`
            : 'No statistically conclusive winner yet — keep the test running.'}
        </span>
        {results.decided && winnerId ? (
          <button className="btn btn-primary btn-sm" onClick={() => onPromote(winnerId)} style={{ flexShrink: 0 }}>
            <Trophy size={12} style={{ marginRight: 4 }} /> Promote winner
          </button>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={onManage}>Manage A/B <ArrowRight size={12} style={{ marginLeft: 4 }} /></button>
        )}
      </div>
    </div>
  );
};
