import React from 'react';
import { Download, TrendingUp, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react';
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

function AreaChart({ data, color, fillColor }: { data: number[]; color: string; fillColor: string }) {
  if (!data.length) return null;
  const W = 800, H = 120, pad = { t: 8, r: 8, b: 24, l: 8 };
  const w = W - pad.l - pad.r;
  const h = H - pad.t - pad.b;
  const max = Math.max(...data, 1);

  const coords = data.map((v, i) => ({
    x: pad.l + (i / (data.length - 1)) * w,
    y: pad.t + h - (v / max) * h,
  }));

  const linePath = `M ${coords.map((c) => `${c.x},${c.y}`).join(' L ')}`;
  const areaPath = `${linePath} L ${coords[coords.length - 1]!.x},${pad.t + h} L ${coords[0]!.x},${pad.t + h} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <path d={areaPath} fill={fillColor} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

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
    if (!pts.length) return '';
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
    if (i === 0 || i === days - 1) return fmtDay(d.day);
    if (i % 7 === 0 && i < days - 4) return fmtDay(d.day);
    return '';
  });

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      {yTicks.map((t) => (
        <g key={t.val}>
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

      {/* X Labels */}
      {xLabels.map((l, i) => l ? (
        <text key={i}
          x={pad.l + (i / (days - 1)) * w}
          y={H - 2}
          textAnchor="middle"
          fontSize={8}
          fill="var(--text-muted)"
        >{l}</text>
      ) : null)}

      {/* Legend */}
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

export const Analytics: React.FC<AnalyticsProps> = ({ onNavigate }) => {
  const { data: campaignsData } = useList({ resource: 'campaigns' });
  const apiUrl = useApiUrl();
  const [range, setRange] = React.useState<'7d' | '30d' | '90d'>('30d');
  const [sortCol, setSortCol] = React.useState<SortCol>('impressions');
  const [sortAsc, setSortAsc] = React.useState(false);

  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;

  const { data: overviewResult, isLoading: overviewLoading } = useCustom({
    url: `${apiUrl}/analytics/overview?days=${days}`,
    method: 'get',
    queryOptions: { queryKey: ['analytics/overview', days] },
  });
  const { data: statsResult, isLoading: statsLoading } = useCustom({
    url: `${apiUrl}/analytics/campaigns?days=${days}`,
    method: 'get',
    queryOptions: { queryKey: ['analytics/campaigns', days] },
  });
  const { data: dailyResult, isLoading: dailyLoading } = useCustom({
    url: `${apiUrl}/analytics/daily`,
    method: 'get',
  });
  const { data: breakdownResult } = useCustom({
    url: `${apiUrl}/analytics/breakdown?days=${days}`,
    method: 'get',
    queryOptions: { queryKey: ['analytics/breakdown', days] },
  });

  const overview = (overviewResult as any)?.data ?? null;
  const breakdown = (breakdownResult as any)?.data ?? null;
  const rawStats: CampaignStat[] = Array.isArray((statsResult as any)?.data)
    ? (statsResult as any).data
    : [];
  const isLoading = overviewLoading || statsLoading || dailyLoading;

  const dailyAll: Array<{ day: string; impressions: number; views: number; clicks: number; conversions: number }> =
    (dailyResult as any)?.data?.daily ?? [];
  // curr period = last N days; prev period = N days before that (for delta calculation)
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

  const getCampaign = (id: string) => campaignsData?.data?.find((c: any) => c.id === id);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortAsc((v) => !v);
    else { setSortCol(col); setSortAsc(false); }
  };

  const kpis = [
    { label: 'Total Impressions', value: overview?.impressions ?? 0,
      delta: pct(sum(curr30,'impressions'), sum(prev30,'impressions')), mono: true },
    { label: 'Total Views',       value: overview?.views ?? 0,
      delta: pct(sum(curr30,'views'), sum(prev30,'views')), mono: true },
    { label: 'Click-Through Rate',
      value: overview ? parseFloat(((overview.ctr ?? 0) * 100).toFixed(2)) : 0,
      delta: pct(currCtr, prevCtr), suffix: '%', mono: true },
    { label: 'Total Conversions', value: overview?.conversions ?? 0,
      delta: pct(sum(curr30,'conversions'), sum(prev30,'conversions')), mono: true },
  ];

  const totalImpr = overview?.impressions ?? 1;
  const funnelStages = [
    { label: 'Impressions', val: overview?.impressions ?? 0 },
    { label: 'Views',       val: overview?.views ?? 0 },
    { label: 'Clicks',      val: overview?.clicks ?? 0 },
    { label: 'Conversions', val: overview?.conversions ?? 0 },
  ];
  const funnelColors = ['var(--data-1)', 'var(--data-2)', 'var(--data-3)', 'var(--data-5)'];

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ChevronUp size={10} style={{ opacity: 0.3 }} />;
    return sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  };

  return (
    <div style={{ maxWidth: 1400, width: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            Analytics
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Track performance metrics and conversion funnels across all campaigns.
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

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 20,
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{k.label}</div>
            {isLoading ? (
              <div className="skeleton" style={{ height: 32, width: 80 }} />
            ) : (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 500,
                color: 'var(--text-primary)', lineHeight: '36px', letterSpacing: '-0.02em',
              }}>
                {k.value >= 10000
                  ? `${(k.value / 1000).toFixed(1)}k`
                  : k.value.toLocaleString()}{k.suffix ?? ''}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <TrendingUp size={11} style={{ color: 'var(--status-success)' }} />
              <span style={{ fontSize: 11, color: 'var(--status-success)' }}>{k.delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Trend chart + Funnel — 2-col */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 24 }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: 20,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
          Trend Analysis
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
            Daily traffic and conversion volume
          </span>
        </h3>
        <TrendChart daily={curr30} />
      </div>

      {/* Conversion funnel */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: 20,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
          Conversion Funnel
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${funnelStages.length}, 1fr)`, gap: 12 }}>
          {funnelStages.map((stage, i) => {
            const pct = totalImpr > 0 ? ((stage.val / totalImpr) * 100).toFixed(1) : '0.0';
            const barW = totalImpr > 0 ? (stage.val / totalImpr) * 100 : 0;
            return (
              <div key={stage.label}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{stage.label}</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500,
                  color: 'var(--text-primary)', marginBottom: 6,
                }}>
                  {stage.val >= 10000
                    ? `${(stage.val / 1000).toFixed(1)}k`
                    : stage.val.toLocaleString()}
                </div>
                <div style={{ height: 4, background: 'var(--bg-raised)', borderRadius: 2, marginBottom: 4 }}>
                  <div style={{ height: '100%', width: `${barW}%`, background: funnelColors[i], borderRadius: 2, transition: 'width 600ms' }} />
                </div>
                <div style={{ fontSize: 11, color: funnelColors[i] }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      </div>{/* end 2-col grid */}

      {/* Campaign breakdown table */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: 20,
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            Campaign Breakdown
          </h3>
          <button
            onClick={() => onNavigate('/campaigns')}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, color: 'var(--text-muted)' }}
          >
            Manage →
          </button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0,1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 44 }} />)}
          </div>
        ) : campaignStats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            No telemetry data yet. Deploy your snippet and events will appear here.
            <br />
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => onNavigate('/campaigns')}>
              View Campaigns
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  {(['impressions','views','clicks','ctr','conversions'] as SortCol[]).map((col) => (
                    <th
                      key={col}
                      style={{ cursor: 'pointer', textAlign: 'right' }}
                      onClick={() => toggleSort(col)}
                    >
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
                    <tr
                      key={row.campaignId}
                      onClick={() => onNavigate(`/campaigns/detail/${row.campaignId}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            background: c?.status === 'active' ? 'var(--status-success)' : 'var(--text-muted)',
                          }} />
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                            {c?.name ?? `Campaign ${row.campaignId.slice(0, 8)}`}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${c?.status === 'active' ? 'badge-success' : c?.status === 'paused' ? 'badge-warning' : 'badge-neutral'}`}>
                          {c?.status ?? 'draft'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {row.impressions.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--data-2)' }}>
                        {row.views.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--data-3)' }}>
                        {row.clicks.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        <span style={{ color: row.ctr > 0.05 ? 'var(--status-success)' : row.ctr > 0 ? 'var(--data-3)' : 'var(--text-muted)' }}>
                          {(row.ctr * 100).toFixed(2)}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--data-4)' }}>
                        {row.conversions.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Breakdown row: Device · Country · Trigger Type ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>

        {/* Device split */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
            Device Split
          </div>
          {breakdown?.devices?.length > 0 ? breakdown.devices.map((d: any) => {
            const total = breakdown.devices.reduce((s: number, x: any) => s + x.count, 0);
            const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
            return (
              <div key={d.device} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{d.device}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{pct}% · {d.count.toLocaleString()}</span>
                </div>
                <div className="usage-bar-track"><div className="usage-bar-fill" style={{ width: `${pct}%`, background: 'var(--accent-500)' }} /></div>
              </div>
            );
          }) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data yet</div>}
          {breakdown && (
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
              Unique visitors: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{(breakdown.uniqueVisitors ?? 0).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Top countries */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
            Top Countries
          </div>
          {breakdown?.countries?.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {breakdown.countries.slice(0, 6).map((c: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0' }}>{c.country === 'unknown' || !c.country ? '—' : c.country}</td>
                    <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textAlign: 'right' }}>{c.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data yet</div>}
        </div>

        {/* Trigger type breakdown */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
            Trigger Breakdown
          </div>
          {breakdown?.triggerTypes?.length > 0 ? breakdown.triggerTypes.map((t: any) => {
            const total = breakdown.triggerTypes.reduce((s: number, x: any) => s + x.count, 0);
            const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
            const label = (t.triggerType as string).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            return (
              <div key={t.triggerType} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{pct}% · {t.count.toLocaleString()}</span>
                </div>
                <div className="usage-bar-track"><div className="usage-bar-fill" style={{ width: `${pct}%`, background: 'var(--data-3)' }} /></div>
              </div>
            );
          }) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data yet</div>}
        </div>
      </div>
    </div>
  );
};
