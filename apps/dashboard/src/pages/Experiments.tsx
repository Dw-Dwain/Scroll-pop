import React from 'react';
import { FlaskConical, ChevronDown, ChevronRight, Trophy, Lock, ArrowRight } from 'lucide-react';
import { useCustom, useApiUrl } from '@refinedev/core';
import { useActiveClient } from '../hooks/useClients';
import { usePlan } from '../hooks/usePlan';
import { authedFetch } from '../providers/dataProvider';
import { DesignThumbnail } from '../components/DesignThumbnail';

interface ExperimentsProps {
  onNavigate: (path: string) => void;
}

interface Journey { id: string; campaignId: string; name: string; status: string; }
interface Variant { id: string; name: string; weight: number; config?: Record<string, unknown> }
interface VariantResult { variantId: string; impressions: number; clicks: number; conversions: number; }
interface ExpData { variants: Variant[]; results: Record<string, VariantResult>; }

const MIN_SAMPLE = 20; // matches ABPanel — below this a "winner" isn't meaningful

const statusBadge = (s: string) =>
  s === 'active' ? 'badge-success' : s === 'paused' ? 'badge-warning' : 'badge-neutral';

export const Experiments: React.FC<ExperimentsProps> = ({ onNavigate }) => {
  const apiUrl = useApiUrl();
  const plan = usePlan();
  const isAgency = plan.plan === 'agency' || plan.isUnlimited;
  const { activeClientId } = useActiveClient();
  const cq = activeClientId ? `?clientId=${activeClientId}` : '';

  const { data: journeysResult, isLoading } = useCustom({
    url: `${apiUrl}/journeys${cq}`,
    method: 'get',
    queryOptions: { queryKey: ['experiments-campaigns', activeClientId], enabled: isAgency },
  });
  const campaigns = ((journeysResult as { data?: Journey[] } | undefined)?.data ?? []);

  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Record<string, ExpData | 'loading'>>({});

  const toggle = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!data[id]) {
      setData((d) => ({ ...d, [id]: 'loading' }));
      try {
        const [vRes, rRes] = await Promise.all([
          authedFetch(`/variants?campaignId=${id}`),
          authedFetch(`/variants/results?campaignId=${id}`),
        ]);
        const vBody = await vRes.json() as { data: Variant[] };
        const rBody = await rRes.json() as { data: VariantResult[] };
        const results: Record<string, VariantResult> = {};
        for (const r of rBody.data) if (r.variantId) results[r.variantId] = r;
        setData((d) => ({ ...d, [id]: { variants: vBody.data ?? [], results } }));
      } catch {
        setData((d) => { const n = { ...d }; delete n[id]; return n; });
      }
    }
  };

  if (!isAgency) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Header />
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
          <Lock size={28} style={{ color: 'var(--text-muted)', marginBottom: 14 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Experiments is an Agency feature</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto' }}>
            Upgrade to the Agency plan to run and compare A/B experiments across every client.
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
                      <ExpResults data={d} onManage={() => onNavigate(`/campaigns/detail/${c.campaignId}`)} />
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
      <span className="badge badge-accent" style={{ fontSize: 9 }}>Agency</span>
    </div>
    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
      Live A/B experiments and their real per-variant results, across every client campaign.
    </p>
  </div>
);

const ExpResults: React.FC<{ data: ExpData; onManage: () => void }> = ({ data, onManage }) => {
  const { variants, results } = data;
  if (variants.length < 2) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          No A/B experiment yet — this campaign serves a single design.
        </span>
        <button className="btn btn-secondary btn-sm" onClick={onManage}>
          Add variants <ArrowRight size={12} style={{ marginLeft: 4 }} />
        </button>
      </div>
    );
  }

  // Winner = highest conversion rate among variants with a meaningful sample.
  let winnerId: string | null = null;
  let bestRate = -1;
  for (const v of variants) {
    const r = results[v.id];
    if (r && r.impressions >= MIN_SAMPLE) {
      const rate = r.conversions / r.impressions;
      if (rate > bestRate) { bestRate = rate; winnerId = v.id; }
    }
  }

  const letter = (i: number) => String.fromCharCode(65 + i); // A, B, C…

  return (
    <div>
      {/* Real visual copies of each A/B variant — the actual saved design, not just a weight. */}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', gap: 8, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
        <span>Variant</span><span style={{ textAlign: 'right' }}>Weight</span><span style={{ textAlign: 'right' }}>Impr.</span><span style={{ textAlign: 'right' }}>CTR</span><span style={{ textAlign: 'right' }}>CVR</span>
      </div>
      {variants.map((v) => {
        const r = results[v.id];
        const ctr = r && r.impressions > 0 ? ((r.clicks / r.impressions) * 100).toFixed(1) + '%' : '—';
        const cvr = r && r.impressions > 0 ? ((r.conversions / r.impressions) * 100).toFixed(1) + '%' : '—';
        const isWinner = v.id === winnerId;
        return (
          <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', gap: 8, fontSize: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-primary)', fontWeight: isWinner ? 600 : 400 }}>
              {isWinner && <Trophy size={12} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />}
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</span>
            </span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{v.weight}%</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{r ? r.impressions.toLocaleString() : '0'}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--data-3)' }}>{ctr}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: isWinner ? 'var(--status-success)' : 'var(--text-primary)' }}>{cvr}</span>
          </div>
        );
      })}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {winnerId ? 'Winner = best conversion rate (≥20 impressions).' : 'Not enough data for a winner yet.'}
        </span>
        <button className="btn btn-secondary btn-sm" onClick={onManage}>Manage A/B <ArrowRight size={12} style={{ marginLeft: 4 }} /></button>
      </div>
    </div>
  );
};
