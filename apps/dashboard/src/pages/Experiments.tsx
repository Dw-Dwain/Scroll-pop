import React from 'react';
import { FlaskConical, BarChart2, Trophy, ArrowRight } from 'lucide-react';

interface ExperimentsProps {
  onNavigate: (path: string) => void;
}

export const Experiments: React.FC<ExperimentsProps> = ({ onNavigate }) => {
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
              Experiments
            </h1>
            <span className="badge badge-neutral" style={{ fontSize: 9 }}>coming soon</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Statistically rigorous A/B/N tests across your campaigns.
          </p>
        </div>
      </div>

      {/* A/B already live callout */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)',
        borderRadius: 10, padding: '14px 18px', marginBottom: 24,
      }}>
        <FlaskConical size={18} style={{ color: '#6366f1', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
            A/B testing is already live — on your campaigns
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Open any campaign's detail page and use the <strong style={{ color: 'var(--text-secondary)' }}>A/B Test panel</strong> to
            create weighted design variants and compare results per variant.
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }} onClick={() => onNavigate('/campaigns')}>
          Go to campaigns <ArrowRight size={12} style={{ marginLeft: 4 }} />
        </button>
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
          <BarChart2 size={24} style={{ color: '#6366f1' }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 10px' }}>
          Full experiment suite — coming in v2
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
          Formal statistical significance testing (Bayesian + frequentist), multi-arm bandit allocation,
          guardrail metrics, and one-click winner declaration — beyond the current variant system.
        </p>
      </div>

      {/* What's planned */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12,
      }}>
        {[
          { icon: <BarChart2 size={15} style={{ color: '#6366f1' }} />, title: 'Statistical significance', desc: 'Bayesian p-values and confidence intervals calculated automatically as data accumulates.' },
          { icon: <FlaskConical size={15} style={{ color: '#10b981' }} />, title: 'Multi-arm bandit', desc: 'Auto-allocate more traffic to winning variants in real time instead of waiting for the test to end.' },
          { icon: <Trophy size={15} style={{ color: '#f59e0b' }} />, title: 'One-click winner', desc: 'Declare a winner, auto-promote its design to the base campaign, and archive losing variants.' },
        ].map(({ icon, title, desc }) => (
          <div key={title} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 8, padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>{icon}<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</span></div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
