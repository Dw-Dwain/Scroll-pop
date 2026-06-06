import React from 'react';
import { Check, Crown, CreditCard, X, TrendingUp, Zap, Building2, RefreshCw, ExternalLink, Clock } from 'lucide-react';
import { usePlan, PLAN_LIMITS, PLAN_PRICES, PLAN_ORDER } from '../hooks/usePlan';
import { useCustomMutation, useCustom } from '@refinedev/core';
import { getApiBase } from '../providers/dataProvider';
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

export const Billing: React.FC<BillingProps> = ({ onNavigate: _onNavigate }) => {
  const { plan: currentPlan, isAdmin, limits } = usePlan();
  const [confirmPlan, setConfirmPlan] = React.useState<PlanId | null>(null);
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [portalLoading, setPortalLoading] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const { mutateAsync: customMutate } = useCustomMutation();

  // Fetch real usage from the API
  const { data: usageData, isLoading: usageLoading } = useCustom({
    url: `${getApiBase()}/billing/usage`,
    method: 'get',
    queryOptions: { staleTime: 30_000 },
  });
  const usage = (usageData?.data as { currentMonthViews?: number; monthlyViewLimit?: number } | undefined) ?? null;
  const currentMonthViews: number = usage?.currentMonthViews ?? 0;
  const monthlyViewLimit: number  = usage?.monthlyViewLimit  ?? limits.maxViews;

  // Detect success return from Stripe Checkout
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing_success') === '1') {
      setToast('🎉 Subscription activated! Your new plan is now live.');
      // Clean the URL without a page reload
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const viewLimit  = isAdmin ? Infinity : monthlyViewLimit;
  const usagePct   = viewLimit === Infinity ? 0 : Math.min((currentMonthViews / Math.max(viewLimit, 1)) * 100, 100);
  const usageColor = usagePct >= 95 ? 'var(--status-error)' : usagePct >= 80 ? 'var(--status-warning)' : 'var(--accent-500)';

  // Open Stripe Checkout — redirects the page to Stripe's hosted payment form.
  const handleUpgrade = async (planId: PlanId) => {
    if (planId === 'free') return; // downgrade is handled via portal
    setCheckoutLoading(true);
    setConfirmPlan(null);
    try {
      const origin = window.location.origin;
      const result = await customMutate({
        url: `${getApiBase()}/billing/checkout`,
        method: 'post',
        values: {
          plan: planId,
          successUrl: `${origin}/billing?billing_success=1`,
          cancelUrl:  `${origin}/billing`,
        },
      });
      const url = (result?.data as { url?: string } | undefined)?.url;
      if (url) {
        window.location.href = url; // hand off to Stripe
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: unknown) {
      setCheckoutLoading(false);
      // Stripe keys not yet configured (server returns 500 / no URL) — show a friendly message
      // instead of surfacing a raw server error (P1-16).
      const msg: string = err instanceof Error ? err.message : '';
      const isStripeNotConfigured = msg.includes('not configured') || msg.includes('No checkout URL') || msg.includes('500') || !msg;
      if (isStripeNotConfigured) {
        showToast('Paid plans are activating soon — we\'ll notify you the moment checkout goes live!');
      } else {
        showToast(msg);
      }
    }
  };

  // Open Stripe Customer Portal — lets user manage/cancel their subscription.
  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const result = await customMutate({
        url: `${getApiBase()}/billing/portal`,
        method: 'post',
        values: { returnUrl: `${window.location.origin}/billing` },
      });
      const url = (result?.data as { url?: string } | undefined)?.url;
      if (url) window.location.href = url;
    } catch (err: unknown) {
      setPortalLoading(false);
      showToast(err instanceof Error ? err.message : 'Could not open subscription portal. Subscribe to a paid plan first.');
    }
  };

  const planRank = (p: PlanId) => PLAN_ORDER.indexOf(p);
  const hasPaidPlan = currentPlan !== 'free';

  const usageRows = [
    { label: 'Monthly Views', used: currentMonthViews, max: viewLimit,          color: usageColor },
    { label: 'Campaigns',     used: 0,                 max: limits.maxCampaigns, color: 'var(--accent-500)' },
    { label: 'Sites',         used: 0,                 max: limits.maxSites,     color: 'var(--accent-500)' },
  ];

  return (
    <div style={{ width: '100%' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 500,
          color: 'var(--text-primary)', zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast}
        </div>
      )}

      {/* Page header */}
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

      {/* Top row: current plan + usage */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, alignItems: 'start' }}>

        {/* Current plan card */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
            Current Plan
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
              {currentPlan}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-muted)' }}>
              {PLAN_PRICES[currentPlan]}/mo
            </span>
          </div>

          {hasPaidPlan ? (
            <button
              className="btn btn-secondary btn-sm"
              style={{ gap: 6, width: '100%', justifyContent: 'center' }}
              onClick={handleManageSubscription}
              disabled={portalLoading}
            >
              {portalLoading
                ? <><RefreshCw size={11} className="spin" /> Opening portal…</>
                : <><CreditCard size={11} /> Manage Subscription</>}
            </button>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={12} /> Free plan — upgrade to unlock more
            </div>
          )}
        </div>

        {/* Usage meters */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
            Usage This Month
            {usageLoading && <span style={{ marginLeft: 8, opacity: 0.5, fontWeight: 400 }}>loading…</span>}
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
          {usagePct >= 80 && !isAdmin && (
            <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 6, fontSize: 11,
              background: usagePct >= 95 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
              color: usagePct >= 95 ? 'var(--status-error)' : 'var(--status-warning)',
              border: `1px solid ${usagePct >= 95 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
            }}>
              {usagePct >= 95
                ? '🔴 View limit almost reached. Popups will stop showing when the limit is hit.'
                : '🟡 You\'re at 80%+ of your monthly view limit.'}
            </div>
          )}
        </div>
      </div>

      {/* Plans grid */}
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
                borderRadius: 8, padding: '16px 14px', position: 'relative',
                display: 'flex', flexDirection: 'column',
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
                {!isCurrent && id !== 'free' && (
                  <button
                    onClick={() => setConfirmPlan(id)}
                    disabled={checkoutLoading}
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

      {/* Feature comparison */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '20px 20px 4px', marginTop: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Feature Comparison</h3>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '28%' }}>Feature</th>
              {PLAN_DETAILS.map(({ id, name }) => (
                <th key={id} style={{ textAlign: 'center', color: id === currentPlan ? 'var(--accent-500)' : 'var(--text-primary)', fontWeight: id === currentPlan ? 600 : 500 }}>
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
                      val ? <Check size={13} style={{ color: 'var(--status-success)', display: 'inline' }} />
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

      {/* Paid-plans-not-live notice (customer-facing) */}
      <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-raised)', borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock size={12} style={{ flexShrink: 0 }} />
        Paid plans are <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>coming soon</strong> — every account is on the Free plan for now. We'll let you know the moment upgrades go live.
      </div>

      {/* Confirm modal */}
      {confirmPlan && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 380 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>
                Switch to {confirmPlan.charAt(0).toUpperCase() + confirmPlan.slice(1)}
              </h3>
              <button className="btn btn-icon" onClick={() => setConfirmPlan(null)}><X size={14} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
              You'll be taken to Stripe's secure checkout page to set up your{' '}
              <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{confirmPlan}</strong> plan
              at <strong style={{ color: 'var(--text-primary)' }}>{PLAN_PRICES[confirmPlan]}/mo</strong>.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
              Your plan upgrades immediately on payment. You can cancel anytime from the billing portal.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmPlan(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={checkoutLoading}
                onClick={() => handleUpgrade(confirmPlan)}
                style={{ gap: 6 }}
              >
                {checkoutLoading
                  ? <><RefreshCw size={12} className="spin" /> Redirecting…</>
                  : <><ExternalLink size={12} /> Continue to Stripe</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
