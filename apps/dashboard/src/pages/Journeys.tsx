import React from 'react';
import { Plus, Search, Zap, Clock, GitBranch, Circle, ArrowRight } from 'lucide-react';
import { useApiUrl, useCustom } from '@refinedev/core';

interface JourneysProps {
  onNavigate: (path: string) => void;
}

export const Journeys: React.FC<JourneysProps> = ({ onNavigate }) => {
  const apiUrl = useApiUrl();
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState<'all' | 'active' | 'paused' | 'draft'>('all');

  const { data: journeysResult } = useCustom({ url: `${apiUrl}/journeys`, method: 'get' });
  const { data: healthResult } = useCustom({ url: `${apiUrl}/ops/campaign-health`, method: 'get' });

  const journeys: any[] = Array.isArray((journeysResult as any)?.data) ? (journeysResult as any).data : [];
  const healthRows: any[] = Array.isArray((healthResult as any)?.data) ? (healthResult as any).data : [];

  const healthByCampaign = React.useMemo(() => {
    const map: Record<string, any> = {};
    for (const row of healthRows) map[row.campaignId] = row;
    return map;
  }, [healthRows]);

  const rows = React.useMemo(() =>
    journeys.filter((j: any) => {
      const matchName = j.name?.toLowerCase().includes(query.toLowerCase());
      const matchStatus = status === 'all' || j.status === status;
      return matchName && matchStatus;
    }),
    [journeys, query, status]
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>Journeys</h1>
            <span className="badge badge-accent" style={{ fontSize: 9 }}>beta</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Behavior-driven conversion journeys mapped to live campaigns.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('/campaigns/new')}>
          <Plus size={14} />
          New Journey
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Search journeys..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {(['all','active','paused','draft'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className="btn btn-sm"
            style={{
              background: status === s ? 'var(--bg-raised)' : 'transparent',
              border: `1px solid ${status === s ? 'var(--border-default)' : 'var(--border-subtle)'}`,
              color: status === s ? 'var(--text-primary)' : 'var(--text-muted)',
              textTransform: 'capitalize',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8,
          padding: '48px 24px', textAlign: 'center',
        }}>
          <GitBranch size={28} style={{ color: 'var(--text-muted)', display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
            {journeys.length === 0 ? 'No journeys yet.' : 'No journeys match your filters.'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Journeys chain popups together into timed conversion flows.
          </p>
          <button className="btn btn-primary" onClick={() => onNavigate('/campaigns/new')}>
            Create your first journey
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
          {rows.map((journey: any) => {
            const health = healthByCampaign[journey.campaignId];
            return (
              <div key={journey.id} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 8, padding: 20,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {journey.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {journey.objective} · {journey.format}
                    </div>
                  </div>
                  <span className={`badge ${
                    journey.status === 'active' ? 'badge-success' :
                    journey.status === 'paused' ? 'badge-warning' :
                    'badge-neutral'
                  }`} style={{ textTransform: 'capitalize' }}>
                    {journey.status}
                  </span>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                  {[
                    { label: 'Health',  val: health?.healthScore ?? '—', color: health?.healthScore > 70 ? 'var(--status-success)' : 'var(--text-secondary)' },
                    { label: 'CTR',     val: health ? `${Math.round((health.ctr ?? 0) * 1000) / 10}%` : '—', color: 'var(--accent-300)' },
                    { label: 'Impr.',   val: health?.impressions?.toLocaleString() ?? '0', color: 'var(--text-secondary)' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{
                      background: 'var(--bg-raised)', borderRadius: 6, padding: '8px 10px',
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Journey flow preview */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, overflow: 'hidden' }}>
                  {(journey.steps ?? [
                    { type: 'trigger', label: 'Scroll 60%' },
                    { type: 'popup',   label: 'Welcome Modal' },
                    { type: 'delay',   label: '2 days' },
                  ]).slice(0, 4).map((step: any, i: number) => (
                    <React.Fragment key={i}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: 'var(--bg-raised)', borderRadius: 4, padding: '3px 8px',
                        fontSize: 10, color: 'var(--text-secondary)', flexShrink: 0,
                      }}>
                        {step.type === 'trigger' ? <Zap size={10} style={{ color: 'var(--accent-300)' }} /> :
                         step.type === 'delay'   ? <Clock size={10} style={{ color: 'var(--data-3)' }} /> :
                                                   <Circle size={10} style={{ color: 'var(--data-2)' }} />}
                        {step.label}
                      </div>
                      {i < 3 && <ArrowRight size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                    </React.Fragment>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    onClick={() => onNavigate(`/campaigns/detail/${journey.campaignId}`)}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11 }}
                  >
                    Diagnose
                  </button>
                  <button
                    onClick={() => onNavigate(`/campaigns/${journey.campaignId}/design`)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11 }}
                  >
                    Open Builder
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
