import React from 'react';
import { Check, Crown, CreditCard, Download, X } from 'lucide-react';
import { usePlan, PLAN_LIMITS, PLAN_PRICES, PLAN_ORDER } from '../hooks/usePlan';
import type { PlanId } from '../hooks/usePlan';

interface BillingProps {
  onNavigate?: (path: string) => void;
}

const PLAN_DETAILS: { id: PlanId; name: string; tagline: string; popular?: boolean }[] = [
  { id: 'free',    name: 'Free',    tagline: 'Get started — no card needed' },
  { id: 'starter', name: 'Starter', tagline: 'For solo creators & bloggers' },
  { id: 'growth',  name: 'Growth',  tagline: 'For growing affiliate sites', popular: true },
  { id: 'scale',   name: 'Scale',   tagline: 'For high-traffic publishers' },
  { id: 'agency',  name: 'Agency',  tagline: 'For agencies & white-label' },
];

function formatLimit(val: number) {
  if (val === Infinity) return 'Unlimited';
  return val.toLocaleString();
}

export const Billing: React.FC<BillingProps> = ({ onNavigate }) => {
  const { plan: currentPlan, isAdmin, limits } = usePlan();
  const [views, setViews] = React.useState(0);
  const [confirmPlan, setConfirmPlan] = React.useState<PlanId | null>(null);

  React.useEffect(() => {
    const isDesktop = !!(window as any).electronAPI?.isDesktop;
    const apiBase = isDesktop ? `${(window as any).electronAPI?.getLocalApiUrl()}/api/v1` : '/api/v1';
    const token = isDesktop ? localStorage.getItem('desktop_token') : null;
    fetch(`${apiBase}/analytics/overview`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.ok ? r.json() : null)
      .then((b) => b?.data?.views && setViews(b.data.views))
      .catch(() => {});
  }, []);

  const viewLimit = isAdmin ? Infinity : limits.maxViews;
  const usagePct  = viewLimit === Infinity ? 0 : Math.min((views / viewLimit) * 100, 100);
  const campaignCount = 0;
  const siteCount = 0;
  const usageColor = usagePct >= 95 ? 'var(--status-error)' : usagePct >= 80 ? 'var(--status-warning)' : 'var(--accent-500)';

  const handleConfirmUpgrade = () => {
    if (!confirmPlan) return;
    const s = JSON.parse(localStorage.getItem('_sp_settings') || '{}');
    s.plan = confirmPlan;
    localStorage.setItem('_sp_settings', JSON.stringify(s));
    window.dispatchEvent(new Event('storage'));
    setConfirmPlan(null);
  };

  const planRank = (p: PlanId) => PLAN_ORDER.indexOf(p);

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>Billing</h1>
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
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>All plan limits are removed.</div>
          </div>
        </div>
      )}

      {/* Current plan + usage */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 8, padding: 20, marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Current Plan</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 500, textTransform: 'capitalize' }}>
                {currentPlan}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-muted)' }}>
                {PLAN_PRICES[currentPlan]}/mo
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Next billing date</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>June 1, 2026</div>
          </div>
        </div>

        {/* Usage bars */}
        {[
          { label: 'Monthly views', used: views, max: viewLimit },
          { label: 'Campaigns',     used: campaignCount, max: limits.maxCampaigns },
          { label: 'Sites',         used: siteCount,     max: limits.maxSites },
        ].map(({ label, used, max }) => {
          const pct = max === Infinity ? 0 : Math.min((used / Math.max(max, 1)) * 100, 100);
          const color = pct >= 95 ? 'var(--status-error)' : pct >= 80 ? 'var(--status-warning)' : usageColor;
          return (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                  {max === Infinity ? '∞' : `${used.toLocaleString()} / ${formatLimit(max)}`}
                </span>
              </div>
              <div className="usage-bar-track">
                <div className="usage-bar-fill" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <CreditCard size={13} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Visa •••• 4242 &nbsp;·&nbsp; Expires 12/27</span>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, marginLeft: 4 }}>Update</button>
        </div>
      </div>

      {/* Pricing cards */}
      <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.01em' }}>
        Plans
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
        {PLAN_DETAILS.map(({ id, name, tagline, popular }) => {
          const isCurrent = id === currentPlan;
          const isUpgrade = planRank(id) > planRank(currentPlan);
          return (
            <div key={id} style={{
              background: 'var(--bg-surface)',
              border: `1px solid ${isCurrent ? 'var(--border-strong)' : popular ? 'var(--accent-500)' : 'var(--border-subtle)'}`,
              borderRadius: 8,
              padding: 16,
              position: 'relative',
            }}>
              {popular && !isCurrent && (
                <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)' }}>
                  <span className="badge badge-accent" style={{ fontSize: 9 }}>Popular</span>
                </div>
              )}
              {isCurrent && (
                <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)' }}>
                  <span className="badge badge-neutral" style={{ fontSize: 9 }}>Current</span>
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                {PLAN_PRICES[id]}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{tagline}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                {formatLimit(PLAN_LIMITS[id].maxViews)} views/mo
              </div>
              {!isCurrent && (
                <button
                  onClick={() => setConfirmPlan(id)}
                  className={`btn btn-sm ${isUpgrade ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}
                >
                  {isUpgrade ? 'Upgrade' : 'Downgrade'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Feature comparison */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 8, padding: 20,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.01em' }}>Feature Comparison</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Feature</th>
              {PLAN_DETAILS.map(({ id, name }) => (
                <th key={id} style={{ textAlign: 'center', color: id === currentPlan ? 'var(--accent-300)' : undefined }}>
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Max Views/mo', vals: PLAN_DETAILS.map((p) => formatLimit(PLAN_LIMITS[p.id].maxViews)) },
              { label: 'Max Sites',    vals: PLAN_DETAILS.map((p) => formatLimit(PLAN_LIMITS[p.id].maxSites)) },
              { label: 'Max Campaigns',vals: PLAN_DETAILS.map((p) => formatLimit(PLAN_LIMITS[p.id].maxCampaigns)) },
              { label: 'A/B Testing',  vals: PLAN_DETAILS.map((p) => PLAN_LIMITS[p.id].abTesting) },
              { label: 'Geo Targeting',vals: PLAN_DETAILS.map((p) => PLAN_LIMITS[p.id].geoTargeting) },
              { label: 'API Access',   vals: PLAN_DETAILS.map((p) => PLAN_LIMITS[p.id].apiAccess) },
              { label: 'White-label',  vals: PLAN_DETAILS.map((p) => PLAN_LIMITS[p.id].whiteLabel) },
            ].map(({ label, vals }) => (
              <tr key={label}>
                <td style={{ fontSize: 12 }}>{label}</td>
                {vals.map((val, i) => (
                  <td key={i} style={{ textAlign: 'center' }}>
                    {typeof val === 'boolean' ? (
                      val
                        ? <Check size={13} style={{ color: 'var(--status-success)', display: 'inline' }} />
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{val}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirm upgrade modal */}
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
              You'll be switched to the <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{confirmPlan}</strong> plan
              at <strong style={{ color: 'var(--text-primary)' }}>{PLAN_PRICES[confirmPlan]}/mo</strong>. Changes take effect immediately.
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
