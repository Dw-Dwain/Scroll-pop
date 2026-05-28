import React from 'react';
import { Check, Crown, CreditCard, X, TrendingUp, Zap, Building2 } from 'lucide-react';
import { usePlan, PLAN_LIMITS, PLAN_PRICES, PLAN_ORDER } from '../hooks/usePlan';
import type { PlanId } from '../hooks/usePlan';

interface BillingProps {
  onNavigate?: (path: string) => void;
}

const PLAN_DETAILS: { id: PlanId; name: string; tagline: string; popular?: boolean; icon: React.ReactNode }[] = [
  { id: 'free',    name: 'Free',    tagline: 'No card needed',              icon: <Zap size={13} /> },
  { id: 'starter', name: 'Starter', tagline: 'Solo creators & bloggers',    icon: <Zap size={13} /> },
  { id: 'growth',  name: 'Growth',  tagline: 'Growing affiliate sites',     icon: <TrendingUp size={13} />, popular: true },
  { id: 'scale',   name: 'Scale',   tagline: 'High-traffic publishers',     icon: <TrendingUp size={13} /> },
  { id: 'agency',  name: 'Agency',  tagline: 'Agencies & white-label',      icon: <Building2 size={13} /> },
];

function formatLimit(val: number) {
  if (val === Infinity) return '∞';
  if (val >= 1_000_000) return `${val / 1_000_000}M`;
  if (val >= 1_000)     return `${val / 1_000}k`;
  return val.toLocaleString();
}

export const Billing: React.FC<BillingProps> = ({ onNavigate }) => {
  const { plan: currentPlan, isAdmin, limits } = usePlan();
  const [views, setViews]             = React.useState(0);
  const [confirmPlan, setConfirmPlan] = React.useState<PlanId | null>(null);

  React.useEffect(() => {
    const isDesktop = !!(window as any).electronAPI?.isDesktop;
    const apiBase   = isDesktop ? `${(window as any).electronAPI?.getLocalApiUrl()}/api/v1` : '/api/v1';
    const token     = isDesktop ? localStorage.getItem('desktop_token') : null;
    fetch(`${apiBase}/analytics/overview`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.ok ? r.json() : null)
      .then((b) => b?.data?.views && setViews(b.data.views))
      .catch(() => {});
  }, []);

  const viewLimit   = isAdmin ? Infinity : limits.maxViews;
  const usagePct    = viewLimit === Infinity ? 0 : Math.min((views / viewLimit) * 100, 100);
  const usageColor  = usagePct >= 95 ? 'var(--status-error)' : usagePct >= 80 ? 'var(--status-warning)' : 'var(--accent-500)';

  const handleConfirmUpgrade = () => {
    if (!confirmPlan) return;
    const s = JSON.parse(localStorage.getItem('_sp_settings') || '{}');
    s.plan = confirmPlan;
    localStorage.setItem('_sp_settings', JSON.stringify(s));
    window.dispatchEvent(new Event('storage'));
    setConfirmPlan(null);
  };

  const planRank = (p: PlanId) => PLAN_ORDER.indexOf(p);

  const usageRows = [
    { label: 'Monthly Views', used: views,    max: viewLimit,             color: usageColor },
    { label: 'Campaigns',      used: 0,        max: limits.maxCampaigns,  color: 'var(--accent-500)' },
    { label: 'Sites',          used: 0,        max: limits.maxSites,      color: 'var(--accent-500)' },
  ];

  return (
    <div style={{ width: '100%' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Billing</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Manage your plan, track usage, and unlock features.
        </p>
      </div>

      {isAdmin && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', marginBottom: 24,
          background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8,
        }}>
          <Crown size={16} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--status-success)' }}>Admin — Unlimited Access</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>All plan limits are removed for your account.</div>
          </div>
        </div>
      )}

      {/* ── Top row: current plan card + usage side by side ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, alignItems: 'start' }}>

        {/* Current plan */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
            Current Plan
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
              {currentPlan}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-muted)' }}>
              {PLAN_PRICES[currentPlan]}/mo
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
            Next billing: <span style={{ color: 'var(--text-secondary)' }}>June 1, 2026</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
            <CreditCard size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>Visa •••• 4242 &nbsp;·&nbsp; Exp 12/27</span>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>Update</button>
          </div>
        </div>

        {/* Usage meters */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
            Usage This Month
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {usageRows.map(({ label, used, max, color }) => {
              const pct = max === Infinity ? 0 : Math.min((used / Math.max(max, 1)) * 100, 100);
              return (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {max === Infinity ? '∞' : `${used.toLocaleString()} / ${formatLimit(max)}`}
                    </span>
                  </div>
                  <div className="usage-bar-track">
                    <div className="usage-bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Plans grid — 5 equal columns ── */}
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 14px', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Plans</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {PLAN_DETAILS.map(({ id, name, tagline, popular, icon }) => {
            const isCurrent = id === currentPlan;
            const isUpgrade = planRank(id) > planRank(currentPlan);
            return (
              <div key={id} style={{
                background: 'var(--bg-surface)',
                border: `1px solid ${isCurrent ? 'var(--border-strong)' : popular ? 'var(--accent-500)' : 'var(--border-subtle)'}`,
                borderRadius: 8,
                padding: '16px 14px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              }}>
                {(popular && !isCurrent) && (
                  <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)' }}>
                    <span className="badge badge-accent" style={{ fontSize: 9 }}>Popular</span>
                  </div>
                )}
                {isCurrent && (
                  <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)' }}>
                    <span className="badge badge-neutral" style={{ fontSize: 9 }}>Current</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--text-muted)' }}>
                  {icon}
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                  {PLAN_PRICES[id]}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>{tagline}</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-500)', fontWeight: 600, marginBottom: 14 }}>
                  {formatLimit(PLAN_LIMITS[id].maxViews)} views/mo
                </div>
                {!isCurrent && (
                  <button
                    onClick={() => setConfirmPlan(id)}
                    className={`btn btn-sm ${isUpgrade ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ width: '100%', justifyContent: 'center', fontSize: 11, marginTop: 'auto' }}
                  >
                    {isUpgrade ? 'Upgrade' : 'Downgrade'}
                  </button>
                )}
                {isCurrent && (
                  <div style={{ fontSize: 11, color: 'var(--status-success)', fontWeight: 600, marginTop: 'auto', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Check size={11} /> Active
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Feature comparison table ── */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 10, padding: '20px 20px 4px', marginTop: 24,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Feature Comparison</h3>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '28%' }}>Feature</th>
              {PLAN_DETAILS.map(({ id, name }) => (
                <th key={id} style={{
                  textAlign: 'center',
                  color: id === currentPlan ? 'var(--accent-500)' : 'var(--text-primary)',
                  fontWeight: id === currentPlan ? 600 : 500,
                }}>
                  {name}
                  {id === currentPlan && <span style={{ fontSize: 9, display: 'block', color: 'var(--accent-500)', opacity: 0.7 }}>current</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Views / mo',    vals: PLAN_DETAILS.map((p) => formatLimit(PLAN_LIMITS[p.id].maxViews)) },
              { label: 'Sites',         vals: PLAN_DETAILS.map((p) => formatLimit(PLAN_LIMITS[p.id].maxSites)) },
              { label: 'Campaigns',     vals: PLAN_DETAILS.map((p) => formatLimit(PLAN_LIMITS[p.id].maxCampaigns)) },
              { label: 'A/B Testing',   vals: PLAN_DETAILS.map((p) => PLAN_LIMITS[p.id].abTesting) },
              { label: 'Geo Targeting', vals: PLAN_DETAILS.map((p) => PLAN_LIMITS[p.id].geoTargeting) },
              { label: 'API Access',    vals: PLAN_DETAILS.map((p) => PLAN_LIMITS[p.id].apiAccess) },
              { label: 'White-label',   vals: PLAN_DETAILS.map((p) => PLAN_LIMITS[p.id].whiteLabel) },
            ].map(({ label, vals }) => (
              <tr key={label}>
                <td style={{ fontSize: 12, color: 'var(--text-primary)' }}>{label}</td>
                {vals.map((val, i) => (
                  <td key={i} style={{ textAlign: 'center' }}>
                    {typeof val === 'boolean' ? (
                      val
                        ? <Check size={13} style={{ color: 'var(--status-success)', display: 'inline' }} />
                        : <span style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1 }}>—</span>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>{val}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Confirm upgrade/downgrade modal ── */}
      {confirmPlan && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 360 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>
                Switch to {confirmPlan.charAt(0).toUpperCase() + confirmPlan.slice(1)}
              </h3>
              <button className="btn btn-icon" onClick={() => setConfirmPlan(null)}><X size={14} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              You'll be switched to the{' '}
              <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{confirmPlan}</strong> plan
              at{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{PLAN_PRICES[confirmPlan]}/mo</strong>.
              {' '}Changes take effect immediately.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmPlan(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmUpgrade}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
