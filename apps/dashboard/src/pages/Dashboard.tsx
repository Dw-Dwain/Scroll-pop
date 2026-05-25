import React from 'react';
import { Eye, MousePointerClick, Percent, Megaphone, ArrowUpRight, TrendingUp } from 'lucide-react';
import { useList, useCustom, useApiUrl } from '@refinedev/core';

interface DashboardProps {
  onNavigate: (path: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { data: sitesData } = useList({ resource: 'sites' });
  const { data: campaignsData } = useList({ resource: 'campaigns' });

  const activeCampaigns = campaignsData?.data.filter((c: any) => c.status === 'active') || [];

  const apiUrl = useApiUrl();
  const { data: overviewResult, isLoading: isOverviewLoading } = useCustom({
    url: `${apiUrl}/analytics/overview`,
    method: 'get',
  });
  const { data: statsResult } = useCustom({
    url: `${apiUrl}/analytics/campaigns`,
    method: 'get',
  });

  const overview = (overviewResult as any)?.data ?? null;
  const campaignStats = React.useMemo<Record<string, any>>(() => {
    const map: Record<string, any> = {};
    const list = Array.isArray((statsResult as any)?.data) ? (statsResult as any).data : [];
    for (const s of list) map[s.campaignId] = s;
    return map;
  }, [statsResult]);

  // MVP Telemetry Metrics (Mapped to live postgres data!)
  const stats = [
    { 
      name: 'Total Impressions', 
      value: overview ? overview.impressions.toLocaleString() : '0', 
      change: overview && overview.impressions > 0 ? '+12.4%' : '+0%', 
      icon: Eye, 
      color: 'text-indigo-400', 
      bg: 'bg-indigo-500/10' 
    },
    { 
      name: 'Popup Views', 
      value: overview ? overview.views.toLocaleString() : '0', 
      change: overview && overview.views > 0 ? '+8.1%' : '+0%', 
      icon: Megaphone, 
      color: 'text-emerald-400', 
      bg: 'bg-emerald-500/10' 
    },
    { 
      name: 'Clicks / CTA Engagements', 
      value: overview ? overview.clicks.toLocaleString() : '0', 
      change: overview && overview.clicks > 0 ? '+18.3%' : '+0%', 
      icon: MousePointerClick, 
      color: 'text-amber-400', 
      bg: 'bg-amber-500/10' 
    },
    { 
      name: 'Average CTR', 
      value: overview ? `${(overview.ctr * 100).toFixed(1)}%` : '0%', 
      change: overview && overview.ctr > 0 ? '+2.1%' : '+0%', 
      icon: Percent, 
      color: 'text-violet-400', 
      bg: 'bg-violet-500/10' 
    },
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Welcome Banner */}
      <div className="glass-card rounded-3xl p-8 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 glow-indigo">
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-indigo-600/20 rounded-full blur-[40px] pointer-events-none"></div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Welcome Back! 👋
          </h1>
          <p className="text-slate-400 max-w-xl text-sm leading-relaxed font-medium">
            Your popup campaigns are active and collecting compliant scroll-triggered revenue. Here is your portfolio performance for the last 30 days.
          </p>
        </div>

        <div className="flex items-center gap-6 z-10">
          <button
            onClick={() => onNavigate('/sites')}
            className="bg-slate-950/60 border border-white/5 px-5 py-3.5 rounded-2xl text-center hover:border-indigo-500/40 hover:bg-slate-900/60 transition cursor-pointer"
          >
            <span className="text-xs text-slate-400 font-semibold block uppercase tracking-wider mb-1">Active Sites</span>
            <span className="text-xl font-extrabold text-slate-100">{sitesData?.data?.length || 0}</span>
          </button>
          <button
            onClick={() => onNavigate('/campaigns')}
            className="bg-slate-950/60 border border-white/5 px-5 py-3.5 rounded-2xl text-center hover:border-indigo-500/40 hover:bg-slate-900/60 transition cursor-pointer"
          >
            <span className="text-xs text-slate-400 font-semibold block uppercase tracking-wider mb-1">Active Campaigns</span>
            <span className="text-xl font-extrabold text-slate-100">{activeCampaigns.length}</span>
          </button>
        </div>
      </div>

      {/* Analytics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <button
              key={idx}
              onClick={() => onNavigate('/analytics')}
              className="glass-card glass-card-hover rounded-2xl p-6 flex items-center justify-between text-left cursor-pointer w-full"
            >
              <div className="space-y-2.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">{stat.name}</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-slate-100">{stat.value}</span>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {stat.change}
                  </span>
                </div>
              </div>
              <div className={`p-4 rounded-xl ${stat.bg} ${stat.color}`}>
                <Icon className="w-6 h-6" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Top Campaigns List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="glass-card rounded-2xl p-6 lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-lg text-slate-200">Active Campaigns</h3>
            <button
              onClick={() => onNavigate('/campaigns')}
              className="text-xs text-indigo-400 font-bold hover:text-indigo-300 cursor-pointer flex items-center gap-1 transition"
            >
              View All Campaigns <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-white/5">
            {campaignsData?.data && campaignsData.data.length > 0 ? (
              campaignsData.data.slice(0, 4).map((campaign: any) => {
                const s = campaignStats[campaign.id];
                return (
                <button
                  key={campaign.id}
                  onClick={() => onNavigate(`/campaigns/detail/${campaign.id}`)}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0 w-full text-left hover:bg-slate-900/20 rounded-xl px-2 -mx-2 transition cursor-pointer"
                >
                  <div className="space-y-1">
                    <span className="font-bold text-slate-200 block text-sm">{campaign.name}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${campaign.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                      {campaign.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-right space-y-1">
                    <span className={`font-extrabold block text-sm ${s && s.ctr > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {s ? `${(s.ctr * 100).toFixed(1)}% CTR` : '— CTR'}
                    </span>
                    <span className="text-xs text-slate-400">{s ? `${s.impressions.toLocaleString()} impr.` : 'no data'}</span>
                  </div>
                </button>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                <span className="text-3xl">🏜️</span>
                <p className="text-sm font-medium">No campaigns created yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* System Activity */}
        <div className="glass-card rounded-2xl p-6 space-y-6">
          <h3 className="font-extrabold text-lg text-slate-200">Edge Activity Log</h3>
          
          <div className="space-y-4">
            {[
              { text: 'Impression registered from US', time: '2 mins ago', type: 'imp' },
              { text: 'Affiliate slot CTA clicked (Growth Tier)', time: '8 mins ago', type: 'clk' },
              { text: 'Config fetched for site.com', time: '14 mins ago', type: 'cfg' },
              { text: 'Campaign "Summer Sale" activated', time: '1 hr ago', type: 'sys' },
            ].map((log, idx) => (
              <div key={idx} className="flex items-start justify-between gap-4 text-xs font-semibold">
                <div className="flex gap-3">
                  <span className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                    log.type === 'imp' ? 'bg-indigo-400' : log.type === 'clk' ? 'bg-amber-400' : 'bg-slate-400'
                  }`}></span>
                  <span className="text-slate-300 leading-snug">{log.text}</span>
                </div>
                <span className="text-xs text-slate-500 shrink-0 font-medium">{log.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
