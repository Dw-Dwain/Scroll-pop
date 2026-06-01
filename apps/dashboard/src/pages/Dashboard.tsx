import React from 'react';
import { Eye, MousePointerClick, Percent, ArrowUpRight, TrendingUp, TrendingDown, Plus, Globe } from 'lucide-react';
import { useList, useCustom, useApiUrl } from '@refinedev/core';

interface DashboardProps {
  onNavigate: (path: string) => void;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const h = 36, w = 80;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    </svg>
  );
}

function useCountUp(target: number, duration = 600) {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    if (target === 0) { setVal(0); return; }
    let start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setVal(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

function KpiCard({
  label,
  value,
  delta,
  suffix = '',
  color,
  spark,
  onClick,
}: {
  label: string;
  value: number;
  delta: string;
  suffix?: string;
  color: string;
  spark: number[];
  onClick: () => void;
}) {
  const displayed = useCountUp(value);
  const positive = !delta.startsWith('-') && delta !== '—';
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: 20,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'background 100ms, border-color 100ms',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: '16px' }}>{label}</span>
        <Sparkline data={spark} color={color} />
      </div>
      <div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 28,
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: '36px',
          letterSpacing: '-0.02em',
        }}>
          {value >= 10000
            ? (displayed / 1000).toFixed(1) + 'k' + suffix
            : displayed.toLocaleString() + suffix}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          {delta === '—' ? null : positive
            ? <TrendingUp size={12} style={{ color: 'var(--status-success)' }} />
            : <TrendingDown size={12} style={{ color: 'var(--status-error)' }} />}
          <span style={{ fontSize: 11, color: delta === '—' ? 'var(--text-muted)' : positive ? 'var(--status-success)' : 'var(--status-error)' }}>
            {delta}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>vs last 30d</span>
        </div>
      </div>
    </button>
  );
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { data: sitesData } = useList({ resource: 'sites' });
  const { data: campaignsData } = useList({ resource: 'campaigns' });
  const apiUrl = useApiUrl();

  // Real-time auto-refresh: poll analytics every 15s so new events surface without a
  // manual reload. Polling pauses automatically while the tab is hidden (default
  // refetchIntervalInBackground: false) and refreshes immediately on window focus.
  const LIVE_MS = 15000;
  const liveOpts = { refetchInterval: LIVE_MS, refetchOnWindowFocus: true } as const;

  const { data: overviewResult, isLoading } = useCustom({
    url: `${apiUrl}/analytics/overview`,
    method: 'get',
    queryOptions: liveOpts,
  });
  const { data: statsResult } = useCustom({
    url: `${apiUrl}/analytics/campaigns`,
    method: 'get',
    queryOptions: liveOpts,
  });
  const { data: recentEventsResult } = useCustom({
    url: `${apiUrl}/analytics/recent`,
    method: 'get',
    queryOptions: liveOpts,
  });
  const { data: dailyResult } = useCustom({
    url: `${apiUrl}/analytics/daily`,
    method: 'get',
    queryOptions: liveOpts,
  });

  const overview = (overviewResult as any)?.data ?? null;
  const recentEvents = (recentEventsResult as any)?.data ?? [];

  // Per-day data: last 60 days split into current 30 and previous 30
  const dailyAll: Array<{ day: string; impressions: number; views: number; clicks: number; conversions: number }> =
    (dailyResult as any)?.data?.daily ?? [];
  const prev30 = dailyAll.slice(0, 30);
  const curr30 = dailyAll.slice(30);

  const sumMetric = (arr: typeof curr30, key: 'impressions' | 'views' | 'clicks') =>
    arr.reduce((s, d) => s + (d[key] ?? 0), 0);

  const pctDelta = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? '+100%' : '—';
    const d = ((curr - prev) / prev) * 100;
    return (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
  };

  const spark = (key: 'impressions' | 'views' | 'clicks') =>
    curr30.slice(-14).map((d) => d[key] ?? 0);

  const campaignStats = React.useMemo<Record<string, any>>(() => {
    const map: Record<string, any> = {};
    const list = Array.isArray((statsResult as any)?.data) ? (statsResult as any).data : [];
    for (const s of list) map[s.campaignId] = s;
    return map;
  }, [statsResult]);

  const topCampaigns = React.useMemo(() => {
    const list = Array.isArray((statsResult as any)?.data) ? (statsResult as any).data : [];
    return list
      .sort((a: any, b: any) => (b.impressions ?? 0) - (a.impressions ?? 0))
      .slice(0, 5)
      .map((s: any) => {
        const c = campaignsData?.data?.find((x: any) => x.id === s.campaignId);
        return { ...s, name: c?.name ?? `Campaign ${s.campaignId?.slice(0, 8)}`, status: c?.status ?? 'draft' };
      });
  }, [statsResult, campaignsData]);

  const recentEventsList = React.useMemo(() => {
    const list = Array.isArray(recentEvents) ? recentEvents.slice(0, 10) : [];
    return list.map((evt: any) => {
      const campaign = campaignsData?.data?.find((c: any) => c.id === evt.campaignId);
      const name = campaign?.name ?? evt.campaignId?.slice(0, 12) ?? '—';
      let ts = '';
      try {
        const diff = Date.now() - new Date(evt.ts).getTime();
        const m = Math.floor(diff / 60000);
        ts = m < 1 ? 'now' : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;
      } catch { ts = '—'; }
      return { type: evt.eventType ?? 'sys', name, ts, domain: evt.domain ?? '' };
    });
  }, [recentEvents, campaignsData]);

  const currImpr  = sumMetric(curr30, 'impressions');
  const currViews = sumMetric(curr30, 'views');
  const currClks  = sumMetric(curr30, 'clicks');
  const prevImpr  = sumMetric(prev30, 'impressions');
  const prevViews = sumMetric(prev30, 'views');
  const prevClks  = sumMetric(prev30, 'clicks');
  const prevCtr   = prevImpr > 0 ? (prevClks / prevImpr) * 100 : 0;
  const currCtr   = currImpr > 0 ? (currClks / currImpr) * 100 : 0;

  const kpis = [
    {
      label: 'Impressions',
      value: overview?.impressions ?? currImpr,
      delta: pctDelta(currImpr, prevImpr),
      color: 'var(--data-1)',
      spark: spark('impressions'),
    },
    {
      label: 'Views',
      value: overview?.views ?? currViews,
      delta: pctDelta(currViews, prevViews),
      color: 'var(--data-2)',
      spark: spark('views'),
    },
    {
      label: 'Clicks',
      value: overview?.clicks ?? currClks,
      delta: pctDelta(currClks, prevClks),
      color: 'var(--data-3)',
      spark: spark('clicks'),
    },
    {
      label: 'CTR',
      value: overview ? Math.round((overview.ctr ?? 0) * 1000) / 10 : Math.round(currCtr * 10) / 10,
      delta: pctDelta(currCtr, prevCtr),
      suffix: '%',
      color: 'var(--data-4)',
      spark: curr30.slice(-14).map((d) => d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0),
    },
  ];

  const activeCampaigns = campaignsData?.data?.filter((c: any) => c.status === 'active') ?? [];

  return (
    <div style={{ width: '100%' }}>
      {/* Page header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 24,
        paddingBottom: 20,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            Portfolio performance — last 30 days
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
              <span className="animate-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-success)' }} />
              Live
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => onNavigate('/sites')}>
            {sitesData?.data?.length ?? 0} sites
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('/campaigns/new')}>
            <Plus size={14} />
            New Campaign
          </button>
        </div>
      </div>

      {/* No-site onboarding banner */}
      {sitesData && sitesData.data?.length === 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '16px 20px',
          marginBottom: 24,
          background: 'rgba(99,102,241,0.04)',
          border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Globe size={16} style={{ color: '#6366f1' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                Connect your first site to get started
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Add a site to install the ScrollPop snippet and start serving campaigns.
              </div>
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onNavigate('/sites')}
            style={{ flexShrink: 0 }}
          >
            <Globe size={13} />
            Link first site
          </button>
        </div>
      )}

      {/* KPI strip */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[0,1,2,3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 8 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          {kpis.map((k) => (
            <KpiCard key={k.label} {...k} onClick={() => onNavigate('/analytics')} />
          ))}
        </div>
      )}

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 24 }}>
        {/* Events over time — area chart placeholder */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Events over time
            </h3>
            <div style={{ display: 'flex', gap: 4 }}>
              {['7d','30d','90d'].map((r) => (
                <button key={r} className="btn btn-ghost btn-sm" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <EventsAreaChart daily={curr30} />
        </div>

        {/* Top campaigns leaderboard */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Top campaigns
            </h3>
            <button
              onClick={() => onNavigate('/campaigns')}
              className="btn btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-300)', fontSize: 11 }}
            >
              View all <ArrowUpRight size={12} />
            </button>
          </div>

          {topCampaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No campaign data yet
            </div>
          ) : (
            <div>
              {topCampaigns.map((c: any, i: number) => (
                <button
                  key={c.campaignId}
                  onClick={() => onNavigate(`/campaigns/detail/${c.campaignId}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 0',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    borderBottom: i < topCampaigns.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', width: 14, textAlign: 'right' }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {(c.impressions ?? 0).toLocaleString()} impr.
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--data-3)' }}>
                    {((c.ctr ?? 0) * 100).toFixed(1)}%
                  </span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => onNavigate('/campaigns')}
            style={{ width: '100%', marginTop: 12, fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            View all campaigns
          </button>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recent events feed */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: 20,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 12px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Recent events
          </h3>
          {recentEventsList.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>No events yet</div>
          ) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {recentEventsList.map((evt, i) => (
                <div key={i} style={{
                  display: 'flex',
                  gap: 8,
                  padding: '4px 0',
                  borderBottom: i < recentEventsList.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  alignItems: 'baseline',
                }}>
                  <span style={{
                    color: evt.type === 'click' ? 'var(--data-2)' :
                           evt.type === 'conversion' ? 'var(--data-3)' :
                           evt.type === 'impression' ? 'var(--data-1)' :
                           'var(--text-muted)',
                    minWidth: 80,
                    fontSize: 10,
                  }}>
                    {evt.type.toUpperCase()}
                  </span>
                  <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {evt.name}
                  </span>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{evt.ts}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active campaigns status */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Active campaigns
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {activeCampaigns.length} running
            </span>
          </div>

          {campaignsData?.data?.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 12 }}>
              <Eye size={24} style={{ color: 'var(--text-muted)' }} />
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
                No campaigns yet.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => onNavigate('/campaigns/new')}>
                Create your first campaign
              </button>
            </div>
          ) : (
            campaignsData?.data?.slice(0, 6).map((c: any) => {
              const s = campaignStats[c.id];
              return (
                <button
                  key={c.id}
                  onClick={() => onNavigate(`/campaigns/detail/${c.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 0',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: '1px solid var(--border-subtle)',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: c.status === 'active' ? 'var(--status-success)' :
                                   c.status === 'paused' ? 'var(--text-muted)' :
                                   'var(--border-default)',
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {s ? `${(s.ctr * 100).toFixed(1)}%` : '—'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDay(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

function EventsAreaChart({ daily }: {
  daily: Array<{ day: string; impressions: number; views: number; clicks: number }>;
}) {
  const W = 600, H = 140;
  const pad = { t: 16, r: 8, b: 20, l: 8 };
  const w = W - pad.l - pad.r;
  const h = H - pad.t - pad.b;

  const days = daily.length || 30;

  const impPts  = daily.map((d) => d.impressions);
  const viewPts = daily.map((d) => d.views);
  const clkPts  = daily.map((d) => d.clicks);

  const max = Math.max(...impPts, ...viewPts, ...clkPts, 1);

  const toPath = (pts: number[], fill = false): string => {
    if (!pts.length) return '';
    const coords = pts.map((v, i) => {
      const x = pad.l + (i / (pts.length - 1)) * w;
      const y = pad.t + h - (v / max) * h;
      return `${x},${y}`;
    });
    if (fill) {
      const last = coords[coords.length - 1]!.split(',');
      const first = coords[0]!.split(',');
      return `M ${coords.join(' L ')} L ${last[0]},${pad.t + h} L ${first[0]},${pad.t + h} Z`;
    }
    return `M ${coords.join(' L ')}`;
  };

  // Always label the first day, last day, and key intervals in between
  const xLabels = daily.map((d, i) => {
    if (i === 0 || i === days - 1) return fmtDay(d.day);
    if (i % 7 === 0 && i < days - 4) return fmtDay(d.day);
    return '';
  });

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <line x1={pad.l} y1={pad.t + h} x2={W - pad.r} y2={pad.t + h} stroke="var(--border-subtle)" strokeWidth={1} />

      {impPts.length > 1 && (
        <>
          <path d={toPath(impPts, true)} fill="rgba(99,102,241,0.07)" />
          <path d={toPath(impPts)} fill="none" stroke="var(--data-1)" strokeWidth={1.5} strokeLinecap="round" />
        </>
      )}
      {viewPts.length > 1 && <path d={toPath(viewPts)} fill="none" stroke="var(--data-2)" strokeWidth={1.5} strokeLinecap="round" />}
      {clkPts.length > 1  && <path d={toPath(clkPts)}  fill="none" stroke="var(--data-3)" strokeWidth={1.5} strokeLinecap="round" />}

      {daily.length === 0 && (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={11} fill="var(--text-muted)">No data yet</text>
      )}

      {xLabels.map((l, i) => l ? (
        <text key={i}
          x={pad.l + (i / (days - 1)) * w}
          y={H - 2}
          textAnchor="middle"
          fontSize={9}
          fill="var(--text-muted)"
        >{l}</text>
      ) : null)}

      {[
        { label: 'Impressions', color: 'var(--data-1)' },
        { label: 'Views',       color: 'var(--data-2)' },
        { label: 'Clicks',      color: 'var(--data-3)' },
      ].map((l, i) => (
        <g key={l.label} transform={`translate(${pad.l + i * 90}, ${pad.t - 4})`}>
          <rect x={0} y={-6} width={8} height={2} rx={1} fill={l.color} />
          <text x={12} y={0} fontSize={9} fill="var(--text-muted)">{l.label}</text>
        </g>
      ))}
    </svg>
  );
}
