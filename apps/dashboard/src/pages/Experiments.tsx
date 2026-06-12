import React from 'react';
import { FlaskConical, ChevronDown, ChevronRight, Trophy, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
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
interface ExperimentResults { variants: VariantResultRow[]; decided: boolean; winnerVariantId: string | null }
interface ExpData { variants: Variant[]; results: ExperimentResults }

const statusBadge = (s: string) =>
  s === 'active' ? 'badge-success' : s === 'paused' ? 'badge-warning' : 'badge-neutral';

export const Experiments: React.FC<ExperimentsProps> = ({ onNavigate }) => {
  const plan = usePlan();
  const canAccess = plan.meetsMinPlan('scale'); // Experiments: Scale + Agency (and unlimited admins)
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
    if (!confirm('Promote this variant to 100% of traffic? The other variants stop showing.')) return;
    const res = await authedFetch(`/variants/promote`, { method: 'POST', body: JSON.stringify({ campaignId, variantId }) });
    if (res.ok) await loadCampaign(campaignId);
    else alert('Could not promote the winner.');
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

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <Header />
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
          <FlaskConical size={26} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No campaigns to experiment on</div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => onNavigate('/campaigns')}>View campaigns</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {campaigns.map((c) => {
            const open = expanded === c.id;
            const d = data[c.id];
            return (
              <div key={c.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                <div onClick={() => void toggle(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}>
                  {open ? <ChevronDown size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                  <span className={`badge ${statusBadge(c.status)}`} style={{ fontSize: 9 }}>{c.status}</span>
                </div>
                {open && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 16px', background: 'var(--bg-raised)' }}>
                    {d === 'loading' || !d ? (
                      <div className="skeleton" style={{ height: 60 }} />
                    ) : (
                      <ExpResults
                        data={d}
                        creating={creating === c.id}
                        onCreate={() => void createVariant(c.id)}
                        onManage={() => onNavigate(`/campaigns/detail/${c.id}`)}
                        onPromote={(variantId) => void promote(c.id, variantId)}
                      />
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
      <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Experiments</h1>
      <span className="badge badge-accent" style={{ fontSize: 9 }}>Scale · Agency</span>
    </div>
    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
      Live A/B experiments with statistical significance — promote the winner when the data is conclusive.
    </p>
  </div>
);

const pct = (n: number | undefined, d = 1) => n === undefined ? '—' : (n * 100).toFixed(d) + '%';

const ExpResults: React.FC<{ data: ExpData; creating: boolean; onCreate: () => void; onManage: () => void; onPromote: (variantId: string) => void }> = ({ data, creating, onCreate, onManage, onPromote }) => {
  const { variants, results } = data;
  const byId = new Map(results.variants.map((r) => [r.variantId, r]));

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
        <span>Variant</span><span style={{ textAlign: 'right' }}>Impr.</span><span style={{ textAlign: 'right' }}>CVR</span><span style={{ textAlign: 'right' }}>Uplift</span><span style={{ textAlign: 'right' }}>Confidence</span><span style={{ textAlign: 'right' }}>Sig.</span>
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
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {results.decided
            ? 'A winner is statistically significant (≥95% confidence, sufficient sample).'
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
