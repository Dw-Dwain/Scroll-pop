import React from 'react';
import { GitBranch, ArrowRight, Zap, Clock, Mail } from 'lucide-react';

interface JourneysProps {
  onNavigate: (path: string) => void;
}

export const Journeys: React.FC<JourneysProps> = ({ onNavigate }) => {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 32, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              Journeys
            </h1>
            <span className="badge badge-neutral" style={{ fontSize: 9 }}>coming soon</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Chain popups together into multi-step conversion flows.
          </p>
        </div>
      </div>

      {/* Coming soon card */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, padding: '48px 40px', textAlign: 'center', marginBottom: 24,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 12, background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 20px',
        }}>
          <GitBranch size={24} style={{ color: '#6366f1' }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 10px' }}>
          Journeys is on the roadmap
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 440, margin: '0 auto 28px', lineHeight: 1.6 }}>
          Journeys will let you chain popups into timed, behaviour-driven sequences — trigger a welcome popup,
          wait two days, then show a discount. Coming in v2.
        </p>

        {/* Flow preview (illustrative) */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, padding: '14px 20px', marginBottom: 28,
        }}>
          {[
            { icon: <Zap size={13} style={{ color: '#6366f1' }} />, label: 'Scroll 60%' },
            { icon: <GitBranch size={13} style={{ color: '#10b981' }} />, label: 'Welcome popup' },
            { icon: <Clock size={13} style={{ color: '#f59e0b' }} />, label: 'Wait 2 days' },
            { icon: <Mail size={13} style={{ color: '#ec4899' }} />, label: 'Offer popup' },
          ].map((step, i) => (
            <React.Fragment key={i}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--bg-surface)', borderRadius: 6, padding: '6px 10px',
                fontSize: 11, color: 'var(--text-secondary)',
              }}>
                {step.icon}
                {step.label}
              </div>
              {i < 3 && <ArrowRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
            </React.Fragment>
          ))}
        </div>

        <div>
          <button className="btn btn-secondary" onClick={() => onNavigate('/campaigns')}>
            Use Campaigns for now
          </button>
        </div>
      </div>

      {/* What's planned */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12,
      }}>
        {[
          { title: 'Timed sequences', desc: 'Show popup B a set number of hours or days after popup A fires.' },
          { title: 'Behaviour branching', desc: 'Branch based on whether the visitor clicked, dismissed, or ignored.' },
          { title: 'Exit recovery chain', desc: 'Auto-escalate from soft nudge to hard offer on exit intent.' },
        ].map(({ title, desc }) => (
          <div key={title} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 8, padding: '16px 18px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
