import React from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, Activity } from 'lucide-react';

interface StatusPageProps { onNavigate: (path: string) => void; }

const SERVICES = [
  { name: 'Dashboard & API',         status: 'operational',   latency: '42ms'  },
  { name: 'Edge Delivery (CF Workers)', status: 'operational', latency: '11ms'  },
  { name: 'Analytics Ingestion',     status: 'operational',   latency: '89ms'  },
  { name: 'Billing & Stripe Webhooks', status: 'operational', latency: '210ms' },
  { name: 'Campaign Config CDN (R2)', status: 'operational',  latency: '18ms'  },
  { name: 'Event Beacon (Redis)',     status: 'operational',   latency: '5ms'   },
];

const StatusDot = ({ status }: { status: string }) => (
  <span style={{
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
    background: status === 'operational' ? '#22c55e' : status === 'degraded' ? '#f59e0b' : '#ef4444',
    boxShadow: status === 'operational' ? '0 0 0 3px rgba(34,197,94,0.2)' : 'none',
  }} />
);

export const StatusPage: React.FC<StatusPageProps> = ({ onNavigate }) => (
  <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 0 60px' }}>
    <button
      onClick={() => onNavigate('/dashboard')}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', padding: '0 0 28px', fontFamily: 'var(--font-sans)' }}
    >
      <ArrowLeft size={14} /> Back to Dashboard
    </button>

    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <Activity size={22} style={{ color: '#22c55e' }} />
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>System Status</h1>
    </div>

    {/* Overall banner */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 32, marginTop: 16 }}>
      <CheckCircle2 size={18} style={{ color: '#22c55e', flexShrink: 0 }} />
      <div>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: '#15803d' }}>All systems operational</div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Last checked: just now</div>
      </div>
    </div>

    {/* Services table */}
    <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
      {SERVICES.map((svc, i) => (
        <div key={svc.name} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusDot status={svc.status} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{svc.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{svc.latency}</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: '#15803d', textTransform: 'capitalize' }}>{svc.status}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);
