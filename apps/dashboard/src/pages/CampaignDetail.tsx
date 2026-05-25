import React from 'react';
import { ArrowLeft, Eye, MousePointerClick, Percent, Megaphone, Calendar, Globe, Sparkles, Sliders } from 'lucide-react';
import { useOne, useList } from '@refinedev/core';

interface CampaignDetailProps {
  campaignId: string;
  onNavigate: (path: string) => void;
}

export const CampaignDetail: React.FC<CampaignDetailProps> = ({ campaignId, onNavigate }) => {
  // Fetch Campaign metadata
  const { data: campaignData, isLoading: isCampaignLoading } = useOne({
    resource: 'campaigns',
    id: campaignId,
  });

  // Fetch Sites to resolve domain
  const { data: sitesData } = useList({ resource: 'sites' });

  // Fetch Daily Analytics breakdown
  const [analytics, setAnalytics] = React.useState<any[]>([]);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = React.useState(true);
  const [selectedPeriod, setSelectedPeriod] = React.useState<'30d' | '7d'>('30d');

  React.useEffect(() => {
    const fetchAnalytics = async () => {
      setIsAnalyticsLoading(true);
      try {
        const apiBase = (window as any).electronAPI?.getLocalApiUrl?.() ?? '';
        const baseUrl = apiBase ? `${apiBase}/api/v1` : '/api/v1';
        const token = localStorage.getItem('desktop_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`${baseUrl}/analytics/campaigns/${campaignId}`, { headers });
        if (res.ok) {
          const body = await res.json();
          setAnalytics(body.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch campaign analytics:', err);
      } finally {
        setIsAnalyticsLoading(false);
      }
    };

    fetchAnalytics();
  }, [campaignId]);

  const campaign = campaignData?.data;
  const site = sitesData?.data.find((s: any) => s.id === campaign?.siteId);

  // Compute aggregated stats
  const aggregatedStats = React.useMemo(() => {
    let impressions = 0;
    let views = 0;
    let clicks = 0;
    let dismissals = 0;
    let conversions = 0;

    // Filter by period if needed (analytics rows contain 'day')
    const filterSince = new Date();
    if (selectedPeriod === '7d') {
      filterSince.setDate(filterSince.getDate() - 7);
    } else {
      filterSince.setDate(filterSince.getDate() - 30);
    }

    const filteredRows = analytics.filter((row) => {
      const rowDate = new Date(row.day);
      return rowDate >= filterSince;
    });

    filteredRows.forEach((row) => {
      if (row.eventType === 'impression') impressions += row.count;
      else if (row.eventType === 'view') views += row.count;
      else if (row.eventType === 'click') clicks += row.count;
      else if (row.eventType === 'dismiss') dismissals += row.count;
      else if (row.eventType === 'conversion') conversions += row.count;
    });

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const viewToClickRate = views > 0 ? (clicks / views) * 100 : 0;

    return {
      impressions,
      views,
      clicks,
      dismissals,
      conversions,
      ctr: parseFloat(ctr.toFixed(2)),
      viewToClickRate: parseFloat(viewToClickRate.toFixed(2)),
    };
  }, [analytics, selectedPeriod]);

  // Group analytics by day for table breakdown
  const dailyBreakdown = React.useMemo(() => {
    const map: Record<string, { day: string; impressions: number; views: number; clicks: number }> = {};

    analytics.forEach((row) => {
      if (!map[row.day]) {
        map[row.day] = { day: row.day, impressions: 0, views: 0, clicks: 0 };
      }
      if (row.eventType === 'impression') map[row.day]!.impressions += row.count;
      else if (row.eventType === 'view') map[row.day]!.views += row.count;
      else if (row.eventType === 'click') map[row.day]!.clicks += row.count;
    });

    return Object.values(map).sort((a, b) => new Date(b.day).getTime() - new Date(a.day).getTime());
  }, [analytics]);

  if (isCampaignLoading || isAnalyticsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium text-sm">Loading campaign performance metrics...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center space-y-4">
        <span className="text-4xl">⚠️</span>
        <h3 className="text-xl font-bold text-slate-200">Campaign Not Found</h3>
        <p className="text-slate-400">The requested campaign does not exist or has been removed.</p>
        <button
          onClick={() => onNavigate('/campaigns')}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition"
        >
          Back to Campaigns
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Header breadcrumb & go back */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/campaigns')}
            className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{campaign.name}</h1>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                campaign.status === 'active' 
                  ? 'bg-emerald-500/20 text-emerald-300' 
                  : 'bg-amber-500/20 text-amber-300'
              }`}>
                {campaign.status}
              </span>
            </div>
            <p className="text-slate-400 text-sm font-medium flex items-center gap-1.5 mt-1">
              <Globe className="w-4 h-4 text-slate-500" /> {site?.domain || 'Custom HTML Integration'}
            </p>
          </div>
        </div>

        {/* Date Filters */}
        <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800 self-start sm:self-center">
          <button
            onClick={() => setSelectedPeriod('7d')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              selectedPeriod === '7d' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setSelectedPeriod('30d')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              selectedPeriod === '30d' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Main performance stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { name: 'Total Impressions', value: aggregatedStats.impressions, label: 'Loaded on Page', icon: Eye, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { name: 'Popup Views', value: aggregatedStats.views, label: 'Rendered in Viewport', icon: Megaphone, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { name: 'CTA Clicks', value: aggregatedStats.clicks, label: 'Affiliate Conversions', icon: MousePointerClick, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { name: 'Click-Through Rate (CTR)', value: `${aggregatedStats.ctr}%`, label: 'Overall Engagement', icon: Percent, color: 'text-violet-400', bg: 'bg-violet-500/10' },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="glass-card rounded-2xl p-6 flex items-center justify-between relative overflow-hidden">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">{stat.name}</span>
                <span className="text-3xl font-black text-white block">{stat.value}</span>
                <span className="text-[11px] text-slate-500 font-medium block">{stat.label}</span>
              </div>
              <div className={`p-4 rounded-xl ${stat.bg} ${stat.color} shrink-0`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Daily Breakdown Table */}
        <div className="glass-card rounded-2xl p-6 lg:col-span-2 space-y-6">
          <div>
            <h3 className="font-extrabold text-lg text-slate-200">Daily Breakdown</h3>
            <p className="text-slate-400 text-xs mt-1">Granular log-level activity tracked across the active period.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 text-right font-medium">Impressions</th>
                  <th className="pb-3 text-right font-medium">Popup Views</th>
                  <th className="pb-3 text-right font-medium">CTA Clicks</th>
                  <th className="pb-3 text-right font-medium">CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {dailyBreakdown.length > 0 ? (
                  dailyBreakdown.map((row) => {
                    const rowCtr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
                    return (
                      <tr key={row.day} className="text-slate-300 hover:bg-slate-900/20 transition">
                        <td className="py-3.5 font-mono text-xs">{new Date(row.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td className="py-3.5 text-right font-bold text-slate-200">{row.impressions.toLocaleString()}</td>
                        <td className="py-3.5 text-right text-emerald-400">{row.views.toLocaleString()}</td>
                        <td className="py-3.5 text-right text-amber-400 font-extrabold">{row.clicks.toLocaleString()}</td>
                        <td className="py-3.5 text-right text-indigo-300 font-bold">{rowCtr.toFixed(1)}%</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500 font-medium">
                      🏜️ No telemetry events received yet. Make sure your embed tag is placed on Shumisphere!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rules & Targeting panel */}
        <div className="space-y-6">
          {/* Active Config specs */}
          <div className="glass-card rounded-2xl p-6 space-y-6">
            <h3 className="font-extrabold text-lg text-slate-200 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" /> Trigger & Rules
            </h3>

            <div className="space-y-4 text-xs font-semibold">
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">Active Triggers</span>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-slate-200 block text-xs font-bold">Scroll Percentage</span>
                    <span className="text-slate-400 block text-[11px] font-medium mt-0.5">Show popup after scrolling 30%</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">Targeting Filters</span>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Target Devices:</span>
                    <span className="text-slate-200 font-extrabold">All Devices</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Frequency Cap:</span>
                    <span className="text-indigo-400 font-extrabold">Once Per Session</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick simulation helper for developers */}
          <div className="glass-card rounded-2xl p-6 border-l-4 border-emerald-500 glow-emerald space-y-4">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              🧪 Real-time Simulator
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Want to see analytics graphs change instantly? You can fire simulated telemetry beacon events directly from the dashboard straight into your database!
            </p>
            <button
              onClick={async () => {
                if (confirm('Simulate 10 random Impressions and 2 Clicks for this campaign?')) {
                  try {
                    // Send simulated events
                    const payload = {
                      events: [
                        ...Array(10).fill(null).map(() => ({
                          campaignId,
                          eventType: 'impression',
                          visitorId: 'sim-visitor',
                          sessionId: 'sim-session',
                          device: Math.random() > 0.5 ? 'desktop' : 'mobile',
                          pageUrl: 'https://shumisphere.com/',
                        })),
                        ...Array(8).fill(null).map(() => ({
                          campaignId,
                          eventType: 'view',
                          visitorId: 'sim-visitor',
                          sessionId: 'sim-session',
                          device: Math.random() > 0.5 ? 'desktop' : 'mobile',
                          pageUrl: 'https://shumisphere.com/',
                        })),
                        ...Array(2).fill(null).map(() => ({
                          campaignId,
                          eventType: 'click',
                          visitorId: 'sim-visitor',
                          sessionId: 'sim-session',
                          device: Math.random() > 0.5 ? 'desktop' : 'mobile',
                          pageUrl: 'https://shumisphere.com/',
                        }))
                      ]
                    };

                    const res = await fetch('https://scrollpop-worker.dwain-scrollpop.workers.dev/e', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });

                    if (res.ok) {
                      alert('Simulated data ingested successfully! Reloading...');
                      window.location.reload();
                    }
                  } catch (err) {
                    alert('Simulation failed.');
                  }
                }
              }}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/10 cursor-pointer text-center"
            >
              Simulate Live Traffic Events
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
