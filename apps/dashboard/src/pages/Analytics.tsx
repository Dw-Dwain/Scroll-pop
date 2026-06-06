import React from 'react';
import { Download, TrendingUp, TrendingDown, ChevronUp, ChevronDown, Zap, DollarSign, MousePointer, Mail } from 'lucide-react';
import { useList, useCustom, useApiUrl } from '@refinedev/core';

interface AnalyticsProps {
  onNavigate: (path: string) => void;
}

type CampaignStat = {
  campaignId: string;
  impressions: number;
  views: number;
  clicks: number;
  conversions: number;
  ctr: number;
};

type SortCol = 'impressions' | 'views' | 'clicks' | 'ctr' | 'conversions';

// ─── SVG Chart Components ──────────────────────────────────────────────────────

function TrendChart({ daily }: {
  daily: Array<{ day: string; impressions: number; views: number; clicks: number; conversions: number }>;
}) {
  const W = 900, H = 160, pad = { t: 24, r: 8, b: 24, l: 40 };
  const w = W - pad.l - pad.r;
  const h = H - pad.t - pad.b;
  const days = daily.length || 30;

  const impPts  = daily.map((d) => d.impressions);
  const viewPts = daily.map((d) => d.views);
  const clkPts  = daily.map((d) => d.clicks);
  const cvPts   = daily.map((d) => d.conversions);

  const maxVal = Math.max(...impPts, ...viewPts, ...clkPts, ...cvPts, 1);

  const toPath = (pts: number[], fill = false): string => {
    if (pts.length < 2) return '';
    const cs = pts.map((v, i) => ({
      x: pad.l + (i / (pts.length - 1)) * w,
      y: pad.t + h - (v / maxVal) * h,
    }));
    const lp = `M ${cs.map((c) => `${c.x},${c.y}`).join(' L ')}`;
    if (fill) return `${lp} L ${cs[cs.length - 1]!.x},${pad.t + h} L ${cs[0]!.x},${pad.t + h} Z`;
    return lp;
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    val: Math.round(maxVal * f),
    y: pad.t + h - f * h,
  }));

  const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmtDay = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
  };

  const xLabels = daily.map((d, i) => {
    if (i === 0 || i === days - 1 || (i % 7 === 0 && i < days - 4)) return fmtDay(d.day);
    return '';
  });

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      {yTicks.map((t, ti) => (
        <g key={ti}>
          <line x1={pad.l} y1={t.y} x2={W - pad.r} y2={t.y} stroke="var(--border-subtle)" strokeWidth={0.5} />
          <text x={pad.l - 6} y={t.y + 3} textAnchor="end" fontSize={8} fill="var(--text-muted)">
            {t.val >= 1000 ? `${(t.val / 1000).toFixed(0)}k` : t.val}
          </text>
        </g>
      ))}
      {impPts.length > 1 && (
        <>
          <path d={toPath(impPts, true)} fill="rgba(99,102,241,0.06)" />
          <path d={toPath(impPts)} fill="none" stroke="var(--data-1)" strokeWidth={1.5} strokeLinecap="round" />
        </>
      )}
      {viewPts.length > 1 && <path d={toPath(viewPts)} fill="none" stroke="var(--data-2)" strokeWidth={1.5} strokeLinecap="round" />}
      {clkPts.length > 1 && <path d={toPath(clkPts)} fill="none" stroke="var(--data-3)" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="3,2" />}
      {cvPts.length > 1 && <path d={toPath(cvPts)} fill="none" stroke="var(--data-5)" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="3,2" />}
      {xLabels.map((l, i) => l ? (
        <text key={i} x={pad.l + (i / (days - 1)) * w} y={H - 2} textAnchor="middle" fontSize={8} fill="var(--text-muted)">{l}</text>
      ) : null)}
      {[
        { label: 'Impressions', color: 'var(--data-1)' },
        { label: 'Views',       color: 'var(--data-2)' },
        { label: 'Clicks',      color: 'var(--data-3)' },
        { label: 'Conversions', color: 'var(--data-5)' },
      ].map((l, i) => (
        <g key={l.label} transform={`translate(${pad.l + i * 110}, ${pad.t - 14})`}>
          <rect x={0} y={-4} width={10} height={2} rx={1} fill={l.color} />
          <text x={14} y={0} fontSize={9} fill="var(--text-muted)">{l.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ─── Funnel Step Bar ───────────────────────────────────────────────────────────

function FunnelBar({ steps, topCount }: {
  steps: Array<{ label: string; count: number; dropOffPct: number }>;
  topCount: number;
}) {
  const colors = [
    'var(--data-1)', 'var(--data-2)', 'var(--data-3)', 'var(--accent-300)',
    'var(--data-4)', 'var(--data-5)', '#f59e0b', '#10b981',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {steps.map((step, i) => {
        const pct = topCount > 0 ? Math.max((step.count / topCount) * 100, step.count > 0 ? 2 : 0) : 0;
        const color = colors[i % colors.length]!;
        return (
          <div key={step.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                {step.label}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: 11 }}>
                {step.count.toLocaleString()}
                {step.count > 0 && topCount > 0 && i > 0 && (
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 10 }}>
                    {((step.count / topCount) * 100).toFixed(1)}%
                  </span>
                )}
              </span>
            </div>
            <div className="usage-bar-track" style={{ height: 6 }}>
              <div className="usage-bar-fill" style={{ width: `${pct}%`, background: color, height: '100%', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export const Analytics: React.FC<AnalyticsProps> = ({ onNavigate }) => {
  const { data: campaignsData } = useList({ resource: 'campaigns' });
  const apiUrl = useApiUrl();
  const [range, setRange] = React.useState<'7d' | '30d' | '90d'>('30d');
  const [sortCol, setSortCol] = React.useState<SortCol>('impressions');
  const [sortAsc, setSortAsc] = React.useState(false);

  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;

  // Real-time auto-refresh: poll every 20s so new events surface without a manual
  // reload. Pauses while the tab is hidden; refreshes on window focus.
  const LIVE_MS = 20000;

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: overviewResult, isLoading: overviewLoading } = useCustom({
    url: `${apiUrl}/analytics/overview?days=${days}`,
    method: 'get',
    queryOptions: { queryKey: ['analytics/overview', days], refetchInterval: LIVE_MS, refetchOnWindowFocus: true },
  });
  const { data: statsResult, isLoading: statsLoading } = useCustom({
    url: `${apiUrl}/analytics/campaigns?days=${days}`,
    method: 'get',
    queryOptions: { queryKey: ['analytics/campaigns', days], refetchInterval: LIVE_MS, refetchOnWindowFocus: true },
  });
  const { data: dailyResult, isLoading: dailyLoading } = useCustom({
    url: `${apiUrl}/analytics/daily`,
    method: 'get',
    queryOptions: { queryKey: ['analytics/daily'], refetchInterval: LIVE_MS, refetchOnWindowFocus: true },
  });
  const { data: breakdownResult } = useCustom({
    url: `${apiUrl}/analytics/breakdown?days=${days}`,
    method: 'get',
    queryOptions: { queryKey: ['analytics/breakdown', days], refetchInterval: LIVE_MS, refetchOnWindowFocus: true },
  });
  const { data: revenueResult, isLoading: revenueLoading } = useCustom({
    url: `${apiUrl}/analytics/revenue?days=${days}`,
    method: 'get',
    queryOptions: { queryKey: ['analytics/revenue', days], refetchInterval: LIVE_MS, refetchOnWindowFocus: true },
  });
  const { data: funnelResult, isLoading: funnelLoading } = useCustom({
    url: `${apiUrl}/analytics/funnel?days=${days}`,
    method: 'get',
    queryOptions: { queryKey: ['analytics/funnel', days], refetchInterval: LIVE_MS, refetchOnWindowFocus: true },
  });
  const { data: intelligenceResult } = useCustom({
    url: `${apiUrl}/analytics/intelligence?days=${days}`,
    method: 'get',
    queryOptions: { queryKey: ['analytics/intelligence', days], refetchInterval: LIVE_MS, refetchOnWindowFocus: true },
  });

  // ── Data extraction ────────────────────────────────────────────────────────
  type ApiWrap<T> = { data?: T } | undefined;
  type OverviewApiData = { impressions: number; views: number; clicks: number; conversions: number; ctr?: number };
  type RevenueApiData = { totals?: { revenueDollars: number; purchases: number; emailCaptures: number; revenuePerVisitor?: number }; campaigns?: RevCampaign[] };
  type FunnelApiData = {
    steps?: Array<{ label: string; count: number; dropOffPct: number }>;
    exitStats?: { closes: number; dismissals: number; rageCloseRate: number };
  };
  type TrafficSource = { source: string; impressions: number; ctr: number };
  type IntelApiData = {
    bestCampaign?: { campaignName: string; revenueDollars: number; ctr: number };
    bestTrafficSource?: { source: string; ctr: number };
    bestTrigger?: { triggerType: string };
    bestDevice?: { device: string };
    trafficSources?: TrafficSource[];
  };
  const overview   = (overviewResult   as ApiWrap<OverviewApiData>)?.data ?? null;
  const breakdown  = (breakdownResult  as ApiWrap<Record<string, unknown>>)?.data ?? null;
  const revenue    = (revenueResult    as ApiWrap<RevenueApiData>)?.data ?? null;
  const funnel     = (funnelResult     as ApiWrap<FunnelApiData>)?.data ?? null;
  const intel      = (intelligenceResult as ApiWrap<IntelApiData>)?.data ?? null;

  const rawStats: CampaignStat[] = React.useMemo(
    () => Array.isArray((statsResult as ApiWrap<CampaignStat[]>)?.data) ? (statsResult as ApiWrap<CampaignStat[]>)!.data! : [],
    [statsResult],
  );
  const isLoading = overviewLoading || statsLoading || dailyLoading;

  const dailyAll: Array<{ day: string; impressions: number; views: number; clicks: number; conversions: number }> =
    (dailyResult as ApiWrap<{ daily?: Array<{ day: string; impressions: number; views: number; clicks: number; conversions: number }> }>)?.data?.daily ?? [];
  const curr30 = dailyAll.slice(30);
  const prev30 = dailyAll.slice(0, 30);

  const sum = (arr: typeof curr30, key: 'impressions' | 'views' | 'clicks' | 'conversions') =>
    arr.reduce((s, d) => s + (d[key] ?? 0), 0);

  const pct = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? '+100%' : '—';
    const d = ((curr - prev) / prev) * 100;
    return (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
  };

  const currImpr = sum(curr30, 'impressions');
  const currClks = sum(curr30, 'clicks');
  const prevImpr = sum(prev30, 'impressions');
  const prevClks = sum(prev30, 'clicks');
  const currCtr  = currImpr > 0 ? (currClks / currImpr) * 100 : 0;
  const prevCtr  = prevImpr > 0 ? (prevClks / prevImpr) * 100 : 0;

  const campaignStats = React.useMemo(() => {
    const arr = [...rawStats];
    arr.sort((a, b) => sortAsc ? a[sortCol] - b[sortCol] : b[sortCol] - a[sortCol]);
    return arr;
  }, [rawStats, sortCol, sortAsc]);

  const getCampaign = (id: string) => campaignsData?.data?.find((c) => (c as { id?: string }).id === id);
  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortAsc((v) => !v);
    else { setSortCol(col); setSortAsc(false); }
  };

  const impr  = overview?.impressions ?? 0;
  const views = overview?.views ?? 0;
  const clks  = overview?.clicks ?? 0;
  const convs = overview?.conversions ?? 0;

  const stepPct = (num: number, denom: number) =>
    denom > 0 ? `${((num / denom) * 100).toFixed(1)}%` : '—';

  const funnelCards = [
    { label: 'Impressions', value: impr,  delta: pct(sum(curr30,'impressions'), sum(prev30,'impressions')), stepLabel: null,           stepVal: null,               color: 'var(--data-1)' },
    { label: 'Views',       value: views, delta: pct(sum(curr30,'views'),       sum(prev30,'views')),       stepLabel: 'of impressions', stepVal: stepPct(views,impr), color: 'var(--data-2)' },
    { label: 'Clicks',      value: clks,  delta: pct(currCtr, prevCtr),                                    stepLabel: 'of views',       stepVal: stepPct(clks,views), color: 'var(--data-3)' },
    { label: 'Conversions', value: convs, delta: pct(sum(curr30,'conversions'), sum(prev30,'conversions')), stepLabel: 'of clicks',      stepVal: stepPct(convs,clks), color: 'var(--data-5)' },
  ];

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ChevronUp size={10} style={{ opacity: 0.3 }} />;
    return sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  };

  // ── Intelligence insights text ─────────────────────────────────────────────
  const insights: string[] = [];
  if (intel?.bestCampaign?.campaignName && intel.bestCampaign.revenueDollars > 0)
    insights.push(`"${intel.bestCampaign.campaignName}" generated $${intel.bestCampaign.revenueDollars.toFixed(2)}`);
  if (intel?.bestTrafficSource?.source)
    insights.push(`Best traffic: ${intel.bestTrafficSource.source} (${intel.bestTrafficSource.ctr}% CTR)`);
  if (intel?.bestTrigger?.triggerType)
    insights.push(`Top trigger: ${(intel.bestTrigger.triggerType as string).replace(/_/g, ' ')}`);
  if (intel?.bestDevice?.device)
    insights.push(`Best device: ${intel.bestDevice.device}`);

  type RevCampaign = { campaignId: string; campaignName?: string; impressions: number; revenueCents: number; revenueDollars?: number; purchases?: number; conversionRate?: number; revenuePerPopup?: number; emailCaptures?: number; ctr?: number };
  type FunnelStep = { label: string; count: number; dropOffPct: number };
  const revCampaigns: RevCampaign[] = (revenue?.['campaigns'] as RevCampaign[] | undefined) ?? [];
  const funnelSteps: FunnelStep[] = (funnel?.['steps'] as FunnelStep[] | undefined) ?? [];
  const funnelTop = funnelSteps.find((s) => s.label === 'Popup Shown')?.count ?? 0;

  return (
    <div style={{ maxWidth: 1400, width: '100%' }}>

      {/* Header ─────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            Analytics
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            Revenue attribution, funnel analysis, and conversion intelligence.
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
              <span className="animate-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-success)' }} />
              Live
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['7d', '30d', '90d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="btn btn-sm"
              style={{
                fontFamily: 'var(--font-mono)',
                background: range === r ? 'var(--bg-raised)' : 'transparent',
                border: `1px solid ${range === r ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                color: range === r ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 11,
              }}
            >
              {r}
            </button>
          ))}
          <button className="btn btn-secondary btn-sm">
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Conversion Intelligence Engine ────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Zap size={14} style={{ color: 'var(--data-3)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Conversion Intelligence
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>— last {days} days</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            {
              icon: DollarSign,
              label: 'Revenue Generated',
              value: (revenue?.totals?.revenueDollars ?? 0) > 0 ? `$${(revenue?.totals?.revenueDollars ?? 0).toFixed(2)}` : '—',
              sub: (revenue?.totals?.purchases ?? 0) > 0 ? `${revenue?.totals?.purchases ?? 0} purchases` : 'No Shopify data yet',
              color: 'var(--status-success)',
            },
            {
              icon: MousePointer,
              label: 'Best Campaign',
              value: intel?.bestCampaign?.campaignName ?? '—',
              sub: (intel?.bestCampaign?.ctr ?? 0) > 0 ? `${intel?.bestCampaign?.ctr ?? 0}% CTR` : 'No campaign data yet',
              color: 'var(--data-1)',
            },
            {
              icon: TrendingUp,
              label: 'Best Traffic Source',
              value: intel?.bestTrafficSource?.source ?? '—',
              sub: (intel?.bestTrafficSource?.ctr ?? 0) > 0 ? `${intel?.bestTrafficSource?.ctr ?? 0}% CTR` : 'No traffic data yet',
              color: 'var(--data-3)',
            },
            {
              icon: Mail,
              label: 'Emails Captured',
              value: (revenue?.totals?.emailCaptures ?? 0) > 0 ? (revenue?.totals?.emailCaptures ?? 0).toLocaleString() : '—',
              sub: impr > 0 && (revenue?.totals?.emailCaptures ?? 0) > 0
                ? `${(((revenue?.totals?.emailCaptures ?? 0) / impr) * 100).toFixed(1)}% of impressions`
                : 'No email captures yet',
              color: 'var(--accent-300)',
            },
          ].map(({ icon: Icon, label, value, sub, color }) => (
            <div key={label} style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '16px 18px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={12} style={{ color }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: '-0.01em', fontFamily: 'var(--font-mono)' }}>
                {value}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.5 }} />
            </div>
          ))}
        </div>
        {insights.length > 0 && (
          <div style={{
            marginTop: 10, padding: '10px 14px',
            background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)',
            display: 'flex', gap: 16, flexWrap: 'wrap',
          }}>
            {insights.map((ins, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--data-1)', fontWeight: 500 }}>↗</span> {ins}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Revenue Dashboard ──────────────────────────────────────────────────── */}
      {!revenueLoading && revCampaigns.some((c) => c.revenueCents > 0) && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <DollarSign size={14} style={{ color: 'var(--status-success)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Revenue Dashboard</span>
          </div>

          {/* Revenue KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Total Revenue', value: `$${(revenue?.totals?.revenueDollars ?? 0).toFixed(2)}`, color: 'var(--status-success)' },
              { label: 'Revenue per Visitor', value: (revenue?.totals?.revenuePerVisitor ?? 0) > 0 ? `$${(revenue?.totals?.revenuePerVisitor ?? 0).toFixed(4)}` : '—', color: 'var(--data-3)' },
              { label: 'Total Purchases', value: (revenue?.totals?.purchases ?? 0).toLocaleString(), color: 'var(--data-1)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '14px 18px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 8 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Revenue by campaign table */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Campaign', 'Revenue', 'Purchases', 'Conv. Rate', 'Rev/Popup', 'Emails', 'CTR'].map((h) => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: h === 'Campaign' ? 'left' : 'right', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {revCampaigns.filter((r) => r.revenueCents > 0 || r.impressions > 0).map((row) => (
                  <tr key={row.campaignId} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                    onClick={() => onNavigate(`/campaigns/detail/${row.campaignId}`)}>
                    <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {row.campaignName ?? row.campaignId}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: (row.revenueDollars ?? 0) > 0 ? 'var(--status-success)' : 'var(--text-muted)' }}>
                      ${(row.revenueDollars ?? 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{(row.purchases ?? 0).toLocaleString()}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{row.conversionRate ?? 0}%</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>${(row.revenuePerPopup ?? 0).toFixed(4)}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{(row.emailCaptures ?? 0).toLocaleString()}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: (row.ctr ?? 0) > 5 ? 'var(--status-success)' : 'var(--text-muted)' }}>{row.ctr ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Full Conversion Funnel ─────────────────────────────────────────────── */}
      {!funnelLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {/* Funnel steps */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 16 }}>
              Conversion Funnel
            </div>
            {funnelSteps.length > 0 && funnelTop > 0 ? (
              <FunnelBar steps={funnelSteps} topCount={funnelTop} />
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                No funnel data yet. Events will appear once your snippet is live.
              </div>
            )}
          </div>

          {/* Exit stats + rage-close */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 16 }}>
              Popup Exit Analysis
            </div>
            {funnel?.exitStats ? (
              <>
                {[
                  { label: 'Intentional Close (✕ button)', value: funnel.exitStats.closes, color: 'var(--status-error)' },
                  { label: 'Passive Dismiss (overlay/link)', value: funnel.exitStats.dismissals, color: 'var(--data-3)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{value.toLocaleString()}</span>
                    </div>
                    <div className="usage-bar-track" style={{ height: 5 }}>
                      <div className="usage-bar-fill" style={{ width: `${funnelTop > 0 ? Math.min((value / funnelTop) * 100, 100) : 0}%`, background: color, height: '100%' }} />
                    </div>
                  </div>
                ))}
                <div style={{
                  marginTop: 16, padding: '12px 14px',
                  background: funnel.exitStats.rageCloseRate > 40 ? 'rgba(239,68,68,0.06)' : 'rgba(99,102,241,0.04)',
                  border: `1px solid ${funnel.exitStats.rageCloseRate > 40 ? 'rgba(239,68,68,0.2)' : 'var(--border-subtle)'}`,
                  borderRadius: 6,
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                    Rage-Close Rate
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: funnel.exitStats.rageCloseRate > 40 ? 'var(--status-error)' : 'var(--text-primary)' }}>
                    {funnel.exitStats.rageCloseRate}%
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {funnel.exitStats.rageCloseRate > 40 ? 'High — consider reducing popup frequency or adjusting timing.' : 'Healthy — users are engaging before closing.'}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No exit data yet.</div>
            )}
          </div>
        </div>
      )}

      {/* ── Standard KPI Funnel Row ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        {funnelCards.map((card, i) => (
          <div key={card.label} style={{
            background: 'var(--bg-surface)',
            borderRight: i < 3 ? '1px solid var(--border-subtle)' : 'none',
            padding: '18px 20px',
            position: 'relative',
          }}>
            {i < 3 && (
              <div style={{
                position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)',
                width: 18, height: 18, background: 'var(--bg-raised)',
                border: '1px solid var(--border-subtle)', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1, fontSize: 9, color: 'var(--text-muted)',
              }}>›</div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.02em', textTransform: 'uppercase', fontWeight: 600 }}>
              {card.label}
            </div>
            {isLoading ? (
              <div className="skeleton" style={{ height: 32, width: 80, marginBottom: 10 }} />
            ) : (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 500, color: 'var(--text-primary)', lineHeight: '36px', letterSpacing: '-0.02em', marginBottom: 8 }}>
                {card.value >= 10000 ? `${(card.value / 1000).toFixed(1)}k` : card.value.toLocaleString()}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {card.stepVal ? (
                <span style={{ fontSize: 12, fontWeight: 600, color: card.color, fontFamily: 'var(--font-mono)' }}>
                  {card.stepVal} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>{card.stepLabel}</span>
                </span>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Entry</span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {card.delta.startsWith('+') ? <TrendingUp size={10} style={{ color: 'var(--status-success)' }} /> : <TrendingDown size={10} style={{ color: card.delta === '—' ? 'var(--text-muted)' : 'var(--status-error)' }} />}
                <span style={{ fontSize: 11, color: card.delta.startsWith('+') ? 'var(--status-success)' : card.delta === '—' ? 'var(--text-muted)' : 'var(--status-error)' }}>
                  {card.delta}
                </span>
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: card.color, opacity: 0.6 }} />
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
          Trend Analysis
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>Daily traffic and conversion volume</span>
        </h3>
        <TrendChart daily={curr30} />
      </div>

      {/* Campaign breakdown table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Campaign Breakdown</h3>
          <button onClick={() => onNavigate('/campaigns')} className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Manage →</button>
        </div>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0,1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 44 }} />)}
          </div>
        ) : campaignStats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            No telemetry data yet. Deploy your snippet and events will appear here.
            <br />
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => onNavigate('/campaigns')}>View Campaigns</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  {(['impressions','views','clicks','ctr','conversions'] as SortCol[]).map((col) => (
                    <th key={col} style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort(col)}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                        {col.charAt(0).toUpperCase() + col.slice(1)}
                        <SortIcon col={col} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaignStats.map((row) => {
                  const c = getCampaign(row.campaignId);
                  return (
                    <tr key={row.campaignId} onClick={() => onNavigate(`/campaigns/detail/${row.campaignId}`)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: c?.status === 'active' ? 'var(--status-success)' : 'var(--text-muted)' }} />
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c?.name ?? `Campaign ${row.campaignId.slice(0, 8)}`}</span>
                        </div>
                      </td>
                      <td><span className={`badge ${c?.status === 'active' ? 'badge-success' : c?.status === 'paused' ? 'badge-warning' : 'badge-neutral'}`}>{c?.status ?? 'draft'}</span></td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{row.impressions.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--data-2)' }}>{row.views.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--data-3)' }}>{row.clicks.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        <span style={{ color: row.ctr > 0.05 ? 'var(--status-success)' : row.ctr > 0 ? 'var(--data-3)' : 'var(--text-muted)' }}>
                          {(row.ctr * 100).toFixed(2)}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--data-4)' }}>{row.conversions.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Breakdowns row ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>

        {/* Device split */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>Device Split</div>
          {(() => { const devs = breakdown ? (breakdown['devices'] as Array<{ device: string; count: number }> | undefined) ?? [] : []; return devs.length > 0 ? devs.map((d) => {
            const total = devs.reduce((s: number, x) => s + x.count, 0);
            const p = total > 0 ? Math.round((d.count / total) * 100) : 0;
            return (
              <div key={d.device} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{d.device}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: 11 }}>{p}%</span>
                </div>
                <div className="usage-bar-track"><div className="usage-bar-fill" style={{ width: `${p}%`, background: 'var(--accent-500)' }} /></div>
              </div>
            );
          }) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data yet</div>; })()}
          {breakdown && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
              Unique visitors: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{((breakdown.uniqueVisitors as number) ?? 0).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Traffic sources */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>Traffic Sources</div>
          {(() => {
            type TrafficSource = { source: string; impressions: number; ctr: number };
            const sources = (intel?.['trafficSources'] as TrafficSource[] | undefined)?.filter((t) => t.source).slice(0, 6) ?? [];
            return sources.length > 0 ? sources.map((t) => {
              const max = sources[0]?.impressions ?? 1;
              const p = Math.round((t.impressions / max) * 100);
              return (
                <div key={t.source} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{t.source}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: 11 }}>{t.ctr}% CTR</span>
                  </div>
                  <div className="usage-bar-track"><div className="usage-bar-fill" style={{ width: `${p}%`, background: 'var(--data-3)' }} /></div>
                </div>
              );
            }) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data yet</div>;
          })()}
        </div>

        {/* Top countries */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>Top Countries</div>
          {(breakdown?.['countries'] as Array<{ country: string; count: number }> | undefined)?.length ?? 0 > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {(breakdown!['countries'] as Array<{ country: string; count: number }>).slice(0, 6).map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0' }}>{c.country === 'unknown' || !c.country ? '—' : c.country}</td>
                    <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textAlign: 'right' }}>{c.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data yet</div>}
        </div>

        {/* Trigger breakdown */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>Trigger Breakdown</div>
          {(() => {
            type TriggerRow = { triggerType: string; count: number };
            const triggerTypes = (breakdown?.['triggerTypes'] as TriggerRow[] | undefined) ?? [];
            return triggerTypes.length > 0 ? triggerTypes.map((t) => {
            const total = triggerTypes.reduce((s: number, x) => s + x.count, 0);
            const p = total > 0 ? Math.round((t.count / total) * 100) : 0;
            const label = t.triggerType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            return (
              <div key={t.triggerType} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: 11 }}>{p}%</span>
                </div>
                <div className="usage-bar-track"><div className="usage-bar-fill" style={{ width: `${p}%`, background: 'var(--data-1)' }} /></div>
              </div>
            );
          }) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data yet</div>;
          })()}
        </div>
      </div>
    </div>
  );
};
