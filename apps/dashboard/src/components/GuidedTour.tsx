import React from 'react';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';

/**
 * Lightweight, dependency-free guided product tour (spotlight + tooltip walkthrough).
 *
 * Each step optionally targets an element by CSS selector (e.g. `[data-tour="sites"]`). The targeted
 * element is spotlit (everything else dims) and a tooltip explains it, with Back / Next / Skip. Steps
 * with no target render a centered card (welcome / finish). Next-driven (page interaction is blocked
 * during the tour) so it can't get into a broken half-clicked state; the final step can carry a CTA.
 *
 * Flag-gated by the caller (ff_onboarding_tour) and persisted via localStorage so it shows once.
 */
export interface TourStep {
  target?: string; // CSS selector of the element to spotlight; omit for a centered step
  title: string;
  body: string;
  placement?: 'bottom' | 'top';
  cta?: { label: string; onClick: () => void }; // optional primary action (e.g. last step)
}

interface GuidedTourProps {
  steps: TourStep[];
  open: boolean;
  onClose: (completed: boolean) => void;
}

const PAD = 6; // spotlight padding around the target
const TIP_W = 300; // tooltip width

export const GuidedTour: React.FC<GuidedTourProps> = ({ steps, open, onClose }) => {
  const [i, setI] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const step = steps[i];

  // Reset to the first step each time the tour (re)opens.
  React.useEffect(() => { if (open) setI(0); }, [open]);

  // Measure the current target (and keep it in sync on resize/scroll).
  React.useEffect(() => {
    if (!open) return;
    const measure = () => {
      const sel = steps[i]?.target;
      if (!sel) { setRect(null); return; }
      const el = document.querySelector(sel);
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      setRect(el.getBoundingClientRect());
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, i, steps]);

  // Keyboard: Esc skips, arrows navigate.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(false);
      else if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, steps.length - 1));
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, steps.length]);

  if (!open || !step) return null;

  const last = i === steps.length - 1;
  const next = () => (last ? onClose(true) : setI((n) => Math.min(n + 1, steps.length - 1)));
  const back = () => setI((n) => Math.max(0, n - 1));

  // Tooltip placement: under/over the target, clamped to the viewport; centered when no target.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  let tipStyle: React.CSSProperties;
  if (rect) {
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - TIP_W / 2), vw - TIP_W - 12);
    tipStyle = step.placement === 'top'
      ? { top: rect.top - 12, left, transform: 'translateY(-100%)' }
      : { top: rect.bottom + 12, left };
  } else {
    tipStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }}>
      {/* Dim + click-catcher: blocks page interaction so the tour is strictly Next-driven.
          When a target is spotlit the dimming comes from the spotlight's box-shadow, so this stays
          transparent; for centered steps it provides the dim itself. */}
      <div style={{ position: 'absolute', inset: 0, background: rect ? 'transparent' : 'rgba(0,0,0,0.55)', backdropFilter: rect ? undefined : 'blur(2px)' }} />

      {/* Spotlight: a hole over the target via a huge surrounding box-shadow. */}
      {rect && (
        <div style={{
          position: 'absolute',
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
          borderRadius: 8,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
          outline: '2px solid var(--accent-500, #6366f1)',
          outlineOffset: 2,
          pointerEvents: 'none',
          transition: 'top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease',
        }} />
      )}

      {/* Tooltip card */}
      <div style={{ position: 'absolute', width: TIP_W, maxWidth: 'calc(100vw - 24px)', background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.45)', ...tipStyle }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Step {i + 1} of {steps.length}</span>
          <button className="btn btn-icon" title="Skip tour" onClick={() => onClose(false)} style={{ width: 22, height: 22 }}><X size={13} /></button>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{step.title}</div>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '0 0 14px' }}>{step.body}</p>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {steps.map((_, n) => (
            <span key={n} style={{ height: 4, flex: 1, borderRadius: 2, background: n <= i ? 'var(--accent-500, #6366f1)' : 'var(--border-subtle)' }} />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {i > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={back} style={{ gap: 4 }}><ArrowLeft size={13} /> Back</button>
          )}
          <div style={{ flex: 1 }} />
          {step.cta ? (
            <button className="btn btn-primary btn-sm" onClick={() => { step.cta!.onClick(); onClose(true); }} style={{ gap: 4 }}>
              {step.cta.label} <ArrowRight size={13} />
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={next} style={{ gap: 4 }}>
              {last ? 'Done' : 'Next'}{!last && <ArrowRight size={13} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
