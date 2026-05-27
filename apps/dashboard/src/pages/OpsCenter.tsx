import React from 'react';
import { Activity, AlertTriangle, Gauge, Radio, TrendingUp, Users, Pause, Play } from 'lucide-react';
import { useApiUrl, useCustom, useList } from '@refinedev/core';

interface OpsCenterProps {
  onNavigate: (path: string) => void;
}

function LiveDot() {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: 'var(--status-success)',
      boxShadow: '0 0 0 3px rgba(34,197,94,0.2)',
      animation: 'pulse 2s infinite',
    }} />
  );
}

function LiveChart({ data }: { data: number[] }) {
  if (!data.length) return null;
  const W = 400, H = 80, pad = { t: 8, r: 4, b: 16, l: 4 };
  const w = W - pad.l - pad.r;
  const h = H - pad.t - pad.b;
  const max = Math.max(...data, 1);
  const coords = data.map((v, i) => ({
    x: pad.l + (i / (data.length - 1)) * w,
    y: pad.t + h - (v / max) * h,
  }));
  const lp = `M ${coords.map((c) => `${c.x},${c.y}`).join(' L ')}`;
  const ap = `${lp} L ${coords[coords.length - 1]!.x},${pad.t + h} L ${coords[0]!.x},${pad.t + h} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      <path d={ap} fill="rgba(99,102,241,0.1)" />
      <path d={lp} fill="none" stroke="var(--data-1)" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

export const OpsCenter: React.FC<OpsCenterProps> = ({ onNavigate }) => {
  const apiUrl = useApiUrl();
  const { data: campaignsData } = useList({ resource: 'campaigns' });
  const { data: overviewResult } = useCustom({ url: `${apiUrl}/ops/overview`, method: 'get' });
  const { data: liveResult } = useCustom({ url: `${apiUrl}/ops/live-events?limit=20`, method: 'get' });
  const { data: healthResult } = useCustom({ url: `${apiUrl}/ops/campaign-health`, method: 'get' });

  const overview = (overviewResult as any)?.data ?? {};
  const baseLiveEvents: any[] = Array.isArray((liveResult as any)?.data) ? (liveResult as any).data : [];
  const healthRows: any[] = Array.isArray((healthResult as any)?.data) ? (healthResult as any).data : [];

  const [streamEvents, setStreamEvents] = React.useState<any[]>([]);
  const [streamOverview, setStreamOverview] = React.useState<any>(null);
  const [paused, setPaused] = React.useState(false);
  const [eventsPerSec, setEventsPerSec] = React.useState<number[]>(Array(24).fill(0));

  const mergedOverview = streamOverview ? { ...overview, ...streamOverview } : overview;
  const liveEvents = streamEvents.length > 0 ? streamEvents : baseLiveEvents;

  const campaignById = React.useMemo(() => {
    const map: Record<string, any> = {};
    for (const row of campaignsData?.data ?? []) {
      if (row?.id) map[String(row.id)] = row;
    }
    return map;
  }, [campaignsData]);

  React.useEffect(() => {
    if (paused) return;
    let es: EventSource | null = null;
    try {
      const origin = window.location.origin.includes('localhost') ? window.location.origin : '';
      es = new EventSource(`${origin}/api/v1/ops/stream`);
      es.addEventListener('ops_kpi_update', (evt: MessageEvent) => {
        try { setStreamOverview((p: any) => ({ ...(p ?? {}), ...JSON.parse(evt.data) })); } catch {}
      });
      es.addEventListener('live_event', (evt: MessageEvent) => {
        try {
          const data = JSON.parse(evt.data);
          setStreamEvents((p) => [data, ...p].slice(0, 24));
          setEventsPerSec((p) => {
            const next = [...p.slice(1), (p[p.length - 1] ?? 0) + 1];
            return next;
          });
        } catch {}
      });
    } catch {}
    return () => { es?.close(); };
  }, [paused]);

  const tiles = [
    { label: 'Active Visitors',      value: mergedOverview.activeVisitorsNow ?? 0,    color: 'var(--data-2)' },
    { label: 'Events / min',         value: mergedOverview.eventsPerMinute ?? 0,       color: 'var(--data-1)' },
    { label: 'Active Campaigns',     value: mergedOverview.activeCampaigns ?? 0,       color: 'var(--status-success)' },
    { label: 'Open Alerts',          value: mergedOverview.alertsOpen ?? 0,            color: mergedOverview.alertsOpen > 0 ? 'var(--status-warning)' : 'var(--text-muted)' },
  ];

  const eventColor = (type: string) =>
    type === 'click' ? 'var(--data-2)' :
    type === 'conversion' ? 'var(--data-3)' :
    type === 'impression' ? 'var(--data-1)' :
    type === 'dismiss' ? 'var(--status-warning)' :
    type === 'error' ? 'var(--status-error)' :
    'var(--text-muted)';

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>Ops Center</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <LiveDot />
            <span style={{ fontSize: 11, color: 'var(--status-success)', fontFamily: 'var(--font-mono)' }}>Live</span>
          </div>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {mergedOverview.eventsPerMinute ?? 0} events/min
          </span>
        </div>
        <button
          onClick={() => setPaused((p) => !p)}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {paused ? <><Play size={13} /> Resume stream</> : <><Pause size={13} /> Pause stream</>}
        </button>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {tiles.map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 8, padding: '16px 20px',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 500, color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Main 4-panel grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Event stream */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16,
          maxHeight: 300, overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Activity size={14} style={{ color: 'var(--data-2)' }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Event Stream</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {liveEvents.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', padding: '12px 0' }}>Waiting for events...</div>
            ) : (
              liveEvents.map((evt: any, i: number) => {
                let ts = '';
                try { ts = new Date(evt.ts).toLocaleTimeString('en', { hour12: false }); } catch {}
                const name = campaignById[evt.campaignId]?.name ?? evt.campaignId?.slice(0, 12) ?? '—';
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '3px 0', color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-muted)', minWidth: 60 }}>{ts}</span>
                    <span style={{ color: eventColor(evt.eventType), minWidth: 80, textTransform: 'uppercase' }}>
                      {evt.eventType?.slice(0, 10)}
                    </span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {evt.domain ?? name}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Events/sec live chart */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <TrendingUp size={14} style={{ color: 'var(--data-1)' }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Events / sec</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>Last 2 min</span>
          </div>
          <LiveChart data={eventsPerSec} />
        </div>

        {/* Campaign health */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Gauge size={14} style={{ color: 'var(--accent-300)' }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Campaign Health</span>
          </div>
          {healthRows.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>No health data yet.</div>
          ) : (
            healthRows.slice(0, 6).map((row: any) => (
              <button
                key={row.campaignId}
                onClick={() => onNavigate(`/campaigns/detail/${row.campaignId}`)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  width: '100%', padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid var(--border-subtle)', textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                    {campaignById[row.campaignId]?.name ?? row.campaignId?.slice(0, 12)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {row.impressions} impr · {Math.round((row.dismissRate ?? 0) * 100)}% dismiss
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-300)' }}>
                    {Math.round((row.ctr ?? 0) * 1000) / 10}%
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Score {row.healthScore}</div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Error rate + queue depth */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <AlertTriangle size={14} style={{ color: 'var(--status-warning)' }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Error Rate & Queue</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Error rate',   value: `${((mergedOverview.errorRate ?? 0) * 100).toFixed(2)}%`, ok: (mergedOverview.errorRate ?? 0) < 0.01 },
              { label: 'Queue depth', value: mergedOverview.queueDepth ?? 0, ok: (mergedOverview.queueDepth ?? 0) < 1000 },
              { label: 'Workers',     value: `${mergedOverview.workersActive ?? 0}/${mergedOverview.workersTotal ?? 3}`, ok: true },
              { label: 'p99 latency', value: `${mergedOverview.p99Latency ?? '—'}ms`, ok: true },
            ].map(({ label, value, ok }) => (
              <div key={label} style={{
                background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '10px 12px',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: ok ? 'var(--text-primary)' : 'var(--status-warning)' }}>
                  {String(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};
