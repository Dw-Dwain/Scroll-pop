import React from 'react';
import { FlaskConical, ChevronDown, Check } from 'lucide-react';
import { usePlan, setPlanOverride, PLAN_ORDER, PLAN_PRICES, type PlanId, type PlanOverride } from '../hooks/usePlan';

/**
 * Lead-dev tier switcher (super-admin only). Lets dwain3991 preview any pricing tier's
 * gating/limits without a Stripe subscription — the override is local-only and never sent
 * to the API. "Unlimited" clears the override (full super-admin access); picking a tier makes
 * the whole dashboard behave as if on that plan (limits + feature gates enforced).
 */
export const AdminTierSwitcher: React.FC = () => {
  const { isAdmin, planOverride, plan } = usePlan();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!isAdmin) return null;

  // null/'unlimited' → showing full access; a PlanId → simulating that tier.
  const simulating = planOverride && planOverride !== 'unlimited';
  const label = simulating ? `${plan} (test)` : 'Unlimited';

  const options: { value: PlanOverride; label: string; sub: string }[] = [
    { value: null, label: 'Unlimited', sub: 'Default super-admin access' },
    ...PLAN_ORDER.map((p: PlanId) => ({ value: p as PlanOverride, label: p, sub: `${PLAN_PRICES[p]}/mo limits` })),
  ];

  const current: PlanOverride = simulating ? (planOverride as PlanId) : null;

  return (
    <div ref={ref} className="hidden md:block" style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Simulate a pricing tier (lead-dev only — no Stripe)"
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20,
          background: simulating ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.07)',
          border: `1px solid ${simulating ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.12)'}`,
          cursor: 'pointer', color: simulating ? '#fbbf24' : 'rgba(255,255,255,0.6)',
          fontSize: 11, fontWeight: 500, textTransform: 'capitalize', whiteSpace: 'nowrap',
        }}
      >
        <FlaskConical size={12} style={{ flexShrink: 0 }} />
        <span>{label}</span>
        <ChevronDown size={11} style={{ opacity: 0.6, transition: 'transform 150ms', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 220,
          background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 8,
          padding: 4, zIndex: 200, boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        }}>
          <div style={{ padding: '6px 10px 4px', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Simulate tier (lead-dev)
          </div>
          {options.map((opt) => {
            const active = current === opt.value;
            return (
              <button
                key={opt.value ?? 'unlimited'}
                onClick={() => { setPlanOverride(opt.value); setOpen(false); }}
                className="nav-item"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px',
                  borderRadius: 5, fontSize: 12.5, background: active ? 'var(--bg-overlay)' : 'none',
                  border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)',
                  textTransform: 'capitalize', fontFamily: 'var(--font-sans)',
                }}
              >
                <span style={{ flex: 1 }}>{opt.label}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'none' }}>{opt.sub}</span>
                {active && <Check size={14} style={{ color: 'var(--accent-500)', flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
