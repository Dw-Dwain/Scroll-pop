import React from 'react';
import { Eye, ArrowUpRight, TrendingUp, TrendingDown, Plus, Globe, CheckCircle2, Circle, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { useList, useCustom, useApiUrl } from '@refinedev/core';
import { useActiveClient } from '../hooks/useClients';

interface DashboardProps {
  onNavigate: (path: string) => void;
}

type ApiCampaign = { id: string; name: string; status?: string; siteId?: string };
type ApiSite = { id: string; verifiedAt?: string | null };
type CampaignStatRow = { campaignId: string; impressions: number; views: number; clicks: number; conversions: number; ctr?: number };
type RecentEvent = { eventType?: string; campaignId?: string; ts?: string; domain?: string };
type DailyRow = { day: string; impressions: number; views: number; clicks: number; conversions: number };
type OverviewData = { impressions: number; views: number; clicks: number; conversions: number; ctr?: number; uniqueVisitors?: number; uniqueClicks?: number };
// Per-campaign dense series point from /analytics/campaigns/daily.
type SeriesPt = { bucket: string; impressions: number; views: number; clicks: number; conversions: number };
// One row of the Campaign performance board: window totals + the daily-clicks trend.
type BoardRow = {
  campaignId: string; name: string; status: string;
  impressions: number; views: number; clicks: number; conversions: number; ctr: number;
  clicksSpark: number[];
  fullSeries: Array<{ day: string; impressions: number; views: number; clicks: number }>;
};

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
  deltaLabel,
  suffix = '',
  color,
  spark,
  onClick,
}: {
  label: string;
  value: number;
  delta: string;
  deltaLabel: string;
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
          {deltaLabel && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{deltaLabel}</span>}
        </div>
      </div>
    </button>
  );
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { data: sitesData } = useList({ resource: 'sites' });
  const { data: campaignsData } = useList({ resource: 'campaigns' });
  const apiUrl = useApiUrl();

  // Portfolio window — drives the KPI counts, the leaderboard, and the events chart together.
  // 24h → hourly buckets; 7d/30d → daily. (The Analytics page has the full picker incl. 90d.)
  const [range, setRange] = React.useState<'24h' | '7d' | '30d'>('30d');
  const windowDays = range === '7d' ? 7 : 30;
  const windowQ = range === '24h' ? 'hours=24' : `days=${windowDays}`;
  const windowLabel = range === '24h' ? 'last 24 hours' : `last ${windowDays} days`;

  // Real-time auto-refresh: poll analytics every 15s so new events surface without a
  // manual reload. Polling pauses automatically while the tab is hidden (default
  // refetchIntervalInBackground: false) and refreshes immediately on window focus.
  const LIVE_MS = 15000;
  const liveOpts = { refetchInterval: LIVE_MS, refetchOnWindowFocus: true } as const;

  // Agency client scoping: scope the client-aware analytics calls to the active client.
  // These useCustom calls have no explicit queryKey, so Refine derives it from the URL — the
  // window query + `&clientId=…` are enough to refetch when the range or active client changes.
  const { activeClientId } = useActiveClient();
  const clientParam = activeClientId ? `&clientId=${activeClientId}` : '';

  const { data: overviewResult, isLoading } = useCustom({
    url: `${apiUrl}/analytics/overview?${windowQ}${clientParam}`,
    method: 'get',
    queryOptions: liveOpts,
  });
  const { data: statsResult } = useCustom({
    url: `${apiUrl}/analytics/campaigns?${windowQ}${clientParam}`,
    method: 'get',
    queryOptions: liveOpts,
  });
  const { data: recentEventsResult } = useCustom({
    url: `${apiUrl}/analytics/recent`,
    method: 'get',
    queryOptions: liveOpts,
  });
  const { data: dailyResult } = useCustom({
    url: `${apiUrl}/analytics/daily?${windowQ}${clientParam}`,
    method: 'get',
    queryOptions: liveOpts,
  });
  // Per-campaign daily/hourly series for the performance board's sparklines (one query, all campaigns).
  const { data: campaignDailyResult } = useCustom({
    url: `${apiUrl}/analytics/campaigns/daily?${windowQ}${clientParam}`,
    method: 'get',
    queryOptions: liveOpts,
  });

  const overview = (overviewResult as { data?: OverviewData } | undefined)?.data ?? null;
  const recentEvents: RecentEvent[] = React.useMemo(
    () => (recentEventsResult as { data?: RecentEvent[] } | undefined)?.data ?? [],
    [recentEventsResult],
  );

  // Per-day data: last 60 days split into current 30 and previous 30 (for deltas + sparklines).
  const dailyAll: DailyRow[] =
    (dailyResult as { data?: { daily?: DailyRow[] } } | undefined)?.data?.daily ?? [];
  const prev30 = dailyAll.slice(0, 30);
  const curr30 = dailyAll.slice(30);
  // Windowed dense series for the "Events over time" chart — moves with the range (24h hourly / N-day).
  const trendSeries: DailyRow[] =
    (dailyResult as { data?: { series?: DailyRow[] } } | undefined)?.data?.series ?? [];
  const trendGranularity: 'hour' | 'day' =
    (dailyResult as { data?: { granularity?: 'hour' | 'day' } } | undefined)?.data?.granularity ?? 'day';

  const sumMetric = (arr: DailyRow[], key: 'impressions' | 'views' | 'clicks') =>
    arr.reduce((s, d) => s + (d[key] ?? 0), 0);

  // Delta comparison window: 30d → vs prev 30d; 7d → vs the 7 days before; 24h → no daily comparison.
  const deltaCurr = range === '7d' ? curr30.slice(-7) : range === '30d' ? curr30 : [];
  const deltaPrev = range === '7d' ? curr30.slice(-14, -7) : range === '30d' ? prev30 : [];
  const deltaLabel = range === '24h' ? '' : range === '7d' ? 'vs prev 7d' : 'vs last 30d';

  const pctDelta = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? '+100%' : '—';
    const d = ((curr - prev) / prev) * 100;
    return (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
  };

  const spark = (key: 'impressions' | 'views' | 'clicks') =>
    curr30.slice(-14).map((d) => d[key] ?? 0);

  const campaignStats = React.useMemo<Record<string, CampaignStatRow>>(() => {
    const map: Record<string, CampaignStatRow> = {};
    const list: CampaignStatRow[] = Array.isArray((statsResult as { data?: CampaignStatRow[] } | undefined)?.data)
      ? (statsResult as { data: CampaignStatRow[] }).data : [];
    for (const s of list) map[s.campaignId] = s;
    return map;
  }, [statsResult]);

  // Rows for the Campaign performance board: every campaign + its window totals + daily-clicks series.
  const boardGranularity: 'hour' | 'day' =
    (campaignDailyResult as { data?: { granularity?: 'hour' | 'day' } } | undefined)?.data?.granularity ?? 'day';
  const boardRows = React.useMemo<BoardRow[]>(() => {
    const series = (campaignDailyResult as { data?: { series?: Record<string, SeriesPt[]> } } | undefined)?.data?.series ?? {};
    const camps = (campaignsData?.data as ApiCampaign[] | undefined) ?? [];
    return camps.map((c) => {
      const s = campaignStats[c.id];
      const full = (series[c.id] ?? []).map((p) => ({ day: p.bucket, impressions: p.impressions, views: p.views, clicks: p.clicks }));
      return {
        campaignId: c.id,
        name: c.name ?? `Campaign ${c.id.slice(0, 8)}`,
        status: c.status ?? 'draft',
        impressions: s?.impressions ?? 0,
        views: s?.views ?? 0,
        clicks: s?.clicks ?? 0,
        conversions: s?.conversions ?? 0,
        ctr: s?.ctr ?? 0,
        clicksSpark: full.map((p) => p.clicks),
        fullSeries: full,
      };
    });
  }, [campaignDailyResult, campaignsData, campaignStats]);

  const recentEventsList = React.useMemo(() => {
    const list = Array.isArray(recentEvents) ? recentEvents.slice(0, 10) : [];
    return list.map((evt) => {
      const campaign = (campaignsData?.data as ApiCampaign[] | undefined)?.find((c) => c.id === evt.campaignId);
      const name = campaign?.name ?? evt.campaignId?.slice(0, 12) ?? '—';
      let ts = '';
      try {
        const diff = Date.now() - new Date(evt.ts ?? '').getTime();
        const m = Math.floor(diff / 60000);
        ts = m < 1 ? 'now' : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;
      } catch { ts = '—'; }
      return { type: evt.eventType ?? 'sys', name, ts, domain: evt.domain ?? '' };
    });
  }, [recentEvents, campaignsData]);

  const currImpr  = sumMetric(deltaCurr, 'impressions');
  const currViews = sumMetric(deltaCurr, 'views');
  const currClks  = sumMetric(deltaCurr, 'clicks');
  const prevImpr  = sumMetric(deltaPrev, 'impressions');
  const prevViews = sumMetric(deltaPrev, 'views');
  const prevClks  = sumMetric(deltaPrev, 'clicks');
  // Clamp the client-side fallback CTR ≤100% (raw click events can exceed impressions — multi-click
  // per popup view; the server CTR is unique-visitor based). Only used until /overview loads.
  const prevCtr   = prevImpr > 0 ? Math.min(prevClks / prevImpr, 1) * 100 : 0;
  const currCtr   = currImpr > 0 ? Math.min(currClks / currImpr, 1) * 100 : 0;

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
      // "Clicks" = total genuine CTA click events (X-close/affiliate redirects are tracked separately
      // as close_ad_click and excluded). Matches the Analytics page + the "Events over time" chart
      // below so the number is identical everywhere. CTR (next tile) is the bounded unique-clicker rate.
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
      spark: curr30.slice(-14).map((d) => d.impressions > 0 ? Math.min(d.clicks / d.impressions, 1) * 100 : 0),
    },
  ];

  const activeCampaigns = (campaignsData?.data as ApiCampaign[] | undefined)?.filter((c) => c.status === 'active') ?? [];

  // Setup checklist — shown until the operator has done the core 4 steps.
  const hasSite      = (sitesData?.data?.length ?? 0) > 0;
  const hasVerified  = (sitesData?.data as ApiSite[] | undefined)?.some((s) => !!s.verifiedAt) ?? false;
  const hasCampaign  = (campaignsData?.data?.length ?? 0) > 0;
  const hasLive      = activeCampaigns.length > 0;
  const setupDone    = hasSite && hasVerified && hasCampaign && hasLive;

  const steps = [
    { done: hasSite,     label: 'Connect a site',              sub: 'Add your domain so we can generate your snippet.',                         path: '/sites',          cta: 'Add site' },
    { done: hasVerified, label: 'Install the snippet',         sub: 'Paste the snippet on your site — or install the WordPress plugin.',        path: '/sites',          cta: 'Install snippet' },
    { done: hasCampaign, label: 'Create your first campaign',  sub: 'Build a popup and choose your triggers.',                                  path: '/campaigns/new',  cta: 'Create campaign' },
    { done: hasLive,     label: 'Launch and go live',          sub: 'Activate a campaign — your popup starts serving immediately.',             path: '/campaigns',      cta: 'Launch campaign' },
  ];

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
            Portfolio performance — {windowLabel}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
              <span className="animate-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-success)' }} />
              Live
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Portfolio window — drives the KPIs, leaderboard, and events chart together. */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginRight: 4 }}>
            {(['24h', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="btn btn-sm"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  background: range === r ? 'var(--bg-raised)' : 'transparent',
                  border: `1px solid ${range === r ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                  color: range === r ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {r}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={() => onNavigate('/sites')}>
            {sitesData?.data?.length ?? 0} sites
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('/campaigns/new')}>
            <Plus size={14} />
            New Campaign
          </button>
        </div>
      </div>

      {/* Setup checklist — shown until all 4 steps are complete */}
      {!setupDone && sitesData && campaignsData && (
        <div style={{ marginBottom: 24, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Get started</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '1px 8px' }}>
                {steps.filter(s => s.done).length}/{steps.length} done
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Your popup goes live once all steps are complete</div>
          </div>
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                borderBottom: i < steps.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                opacity: step.done ? 0.5 : 1,
              }}
            >
              {step.done
                ? <CheckCircle2 size={18} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
                : <Circle size={18} style={{ color: 'var(--border-default)', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: step.done ? 400 : 500, color: step.done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: step.done ? 'line-through' : 'none' }}>
                  {step.label}
                </div>
                {!step.done && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{step.sub}</div>}
              </div>
              {!step.done && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onNavigate(step.path)}
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {step.cta}<ChevronRight size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

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
            <KpiCard key={k.label} {...k} deltaLabel={deltaLabel} onClick={() => onNavigate('/analytics')} />
          ))}
        </div>
      )}

      {/* Events over time — full-width live area chart (EventsAreaChart, driven by /analytics/daily) */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: 20,
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Events over time
          </h3>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {trendGranularity === 'hour' ? 'Hourly' : 'Daily'} · {windowLabel}
          </span>
        </div>
        <EventsAreaChart daily={trendSeries} granularity={trendGranularity} />
      </div>

      {/* Campaign performance board — per-campaign clicks (daily) + drill-down, all in one place */}
      <CampaignPerformanceBoard rows={boardRows} granularity={boardGranularity} windowLabel={windowLabel} onNavigate={onNavigate} />

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
            (campaignsData?.data as ApiCampaign[] | undefined)?.slice(0, 6).map((c) => {
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
                    {s ? `${((s.ctr ?? 0) * 100).toFixed(1)}%` : '—'}
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

function EventsAreaChart({ daily, granularity = 'day' }: {
  daily: Array<{ day: string; impressions: number; views: number; clicks: number }>;
  granularity?: 'hour' | 'day';
}) {
  // Format an x-axis label: hourly buckets (…T14:00:00Z) → local HH:MM; daily → "Jun 18".
  const fmtLabel = (iso: string) =>
    granularity === 'hour'
      ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      : fmtDay(iso);
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

  // ~6 evenly spaced labels (first, last, and intervals between) across whatever window is selected.
  const every = Math.max(1, Math.ceil(days / 6));
  const xLabels = daily.map((d, i) => (i === 0 || i === days - 1 || i % every === 0) ? fmtLabel(d.day) : '');

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

// ── Campaign performance board ────────────────────────────────────────────────
// One place to review every campaign: window totals (impr/views/clicks/CTR/conv) + a daily-clicks
// sparkline per row, sortable, with an inline drill-down chart on row click. This is what Jon asked
// for — "how many clicks in a campaign on a daily basis" — without leaving the Dashboard.
type BoardSortCol = 'impressions' | 'views' | 'clicks' | 'ctr' | 'conversions';
function CampaignPerformanceBoard({ rows, granularity, windowLabel, onNavigate }: {
  rows: BoardRow[];
  granularity: 'hour' | 'day';
  windowLabel: string;
  onNavigate: (path: string) => void;
}) {
  const [sortCol, setSortCol] = React.useState<BoardSortCol>('clicks');
  const [sortAsc, setSortAsc] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const sorted = React.useMemo(
    () => [...rows].sort((a, b) => (sortAsc ? a[sortCol] - b[sortCol] : b[sortCol] - a[sortCol])),
    [rows, sortCol, sortAsc],
  );

  const toggle = (col: BoardSortCol) => {
    if (sortCol === col) setSortAsc((v) => !v);
    else { setSortCol(col); setSortAsc(false); }
  };

  const numCols: Array<{ key: BoardSortCol; label: string; color?: string; bold?: boolean }> = [
    { key: 'impressions', label: 'Impr.' },
    { key: 'views',       label: 'Views',  color: 'var(--data-2)' },
    { key: 'clicks',      label: 'Clicks', color: 'var(--data-3)', bold: true },
    { key: 'ctr',         label: 'CTR' },
    { key: 'conversions', label: 'Conv.',  color: 'var(--data-4)' },
  ];

  const headCell: React.CSSProperties = {
    padding: '8px 10px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Campaign performance
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '3px 0 0' }}>
            Clicks per campaign on a {granularity === 'hour' ? 'hourly' : 'daily'} basis · {windowLabel} · click a row for the full chart
          </p>
        </div>
        <button onClick={() => onNavigate('/analytics')} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-300)', fontSize: 11, flexShrink: 0 }}>
          Full analytics <ArrowUpRight size={12} />
        </button>
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>No campaigns yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ ...headCell, textAlign: 'left' }}>Campaign</th>
                <th style={{ ...headCell, textAlign: 'left' }}>Clicks trend</th>
                {numCols.map((c) => (
                  <th key={c.key} onClick={() => toggle(c.key)} style={{ ...headCell, textAlign: 'right', cursor: 'pointer' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                      {c.label}
                      {sortCol === c.key
                        ? (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
                        : <ChevronUp size={10} style={{ opacity: 0.25 }} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const isOpen = expanded === row.campaignId;
                return (
                  <React.Fragment key={row.campaignId}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : row.campaignId)}
                      style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', background: isOpen ? 'var(--bg-raised)' : 'transparent' }}
                    >
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: row.status === 'active' ? 'var(--status-success)' : row.status === 'paused' ? 'var(--text-muted)' : 'var(--border-default)' }} />
                          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{row.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        {row.clicksSpark.some((v) => v > 0)
                          ? <Sparkline data={row.clicksSpark} color="var(--data-3)" />
                          : <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>—</span>}
                      </td>
                      {numCols.map((c) => (
                        <td key={c.key} style={{ textAlign: 'right', padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 12, color: c.color ?? 'var(--text-secondary)', fontWeight: c.bold ? 600 : 400 }}>
                          {c.key === 'ctr' ? `${(row.ctr * 100).toFixed(2)}%` : row[c.key].toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={2 + numCols.length} style={{ padding: '6px 10px 16px', background: 'var(--bg-raised)' }}>
                          {row.fullSeries.some((p) => p.impressions || p.views || p.clicks)
                            ? <EventsAreaChart daily={row.fullSeries} granularity={granularity} />
                            : <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No traffic in this window yet.</div>}
                          <div style={{ textAlign: 'right', marginTop: 8 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); onNavigate(`/campaigns/detail/${row.campaignId}`); }}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 11, gap: 4 }}
                            >
                              Open campaign <ArrowUpRight size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
