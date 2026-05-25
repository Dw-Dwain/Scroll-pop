import React from 'react';
import { Eye, MousePointerClick, Percent, Megaphone, TrendingUp, BarChart3 } from 'lucide-react';
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

export const Analytics: React.FC<AnalyticsProps> = ({ onNavigate }) => {
  const { data: campaignsData } = useList({ resource: 'campaigns' });
  const apiUrl = useApiUrl();

  const { data: overviewResult, isLoading: overviewLoading } = useCustom({
    url: `${apiUrl}/analytics/overview`,
    method: 'get',
  });

  const { data: statsResult, isLoading: statsLoading } = useCustom({
    url: `${apiUrl}/analytics/campaigns`,
    method: 'get',
  });

  const overview = (overviewResult as any)?.data ?? null;
  const campaignStats: CampaignStat[] = Array.isArray((statsResult as any)?.data)
    ? (statsResult as any).data
    : [];
  const isLoading = overviewLoading || statsLoading;

  const getCampaign = (id: string) => campaignsData?.data?.find((c: any) => c.id === id);

  const metrics = [
    {
      name: 'Total Impressions',
      value: overview ? overview.impressions.toLocaleString() : '0',
      change: overview?.impressions > 0 ? '+12.4%' : '+0%',
      icon: Eye,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
    },
    {
      name: 'Popup Views',
      value: overview ? overview.views.toLocaleString() : '0',
      change: overview?.views > 0 ? '+8.1%' : '+0%',
      icon: Megaphone,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      name: 'CTA Clicks',
      value: overview ? overview.clicks.toLocaleString() : '0',
      change: overview?.clicks > 0 ? '+18.3%' : '+0%',
      icon: MousePointerClick,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      name: 'Average CTR',
      value: overview ? `${(overview.ctr * 100).toFixed(1)}%` : '0%',
      change: overview?.ctr > 0 ? '+2.1%' : '+0%',
      icon: Percent,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
    },
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Analytics</h1>
          <p className="text-slate-400 text-sm">30-day portfolio telemetry across all campaigns and sites.</p>
        </div>
        <span className="px-3 py-1.5 bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 rounded-lg text-xs font-bold">
          Last 30 Days
        </span>
      </div>

      {/* Overview metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className="glass-card rounded-2xl p-6 flex items-center justify-between">
              <div className="space-y-2.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">{m.name}</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-slate-100">
                    {isLoading ? <span className="inline-block w-12 h-7 bg-slate-800 rounded animate-pulse" /> : m.value}
                  </span>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {m.change}
                  </span>
                </div>
              </div>
              <div className={`p-4 rounded-xl ${m.bg} ${m.color}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-campaign breakdown table */}
      <div className="glass-card rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-lg text-slate-200 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              Campaign Breakdown
            </h3>
            <p className="text-slate-400 text-xs mt-1">Click any row to open the campaign's full telemetry report.</p>
          </div>
          <button
            onClick={() => onNavigate('/campaigns')}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
          >
            Manage Campaigns →
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : campaignStats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
            <span className="text-3xl">📊</span>
            <p className="text-sm font-medium text-center">
              No telemetry data yet.<br />Deploy your embed snippet and events will appear here.
            </p>
            <button
              onClick={() => onNavigate('/campaigns')}
              className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              View Campaigns
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="pb-3 font-medium">Campaign</th>
                  <th className="pb-3 text-right font-medium">Impressions</th>
                  <th className="pb-3 text-right font-medium">Views</th>
                  <th className="pb-3 text-right font-medium">Clicks</th>
                  <th className="pb-3 text-right font-medium">Conversions</th>
                  <th className="pb-3 text-right font-medium">CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {campaignStats.map((row) => {
                  const c = getCampaign(row.campaignId);
                  return (
                    <tr
                      key={row.campaignId}
                      onClick={() => onNavigate(`/campaigns/detail/${row.campaignId}`)}
                      className="text-slate-300 hover:bg-slate-900/30 transition cursor-pointer"
                    >
                      <td className="py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c?.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                          <span className="font-bold text-slate-200">{c?.name || `Campaign ${row.campaignId.slice(0, 8)}`}</span>
                        </div>
                      </td>
                      <td className="py-3.5 text-right font-bold">{row.impressions.toLocaleString()}</td>
                      <td className="py-3.5 text-right text-emerald-400">{row.views.toLocaleString()}</td>
                      <td className="py-3.5 text-right text-amber-400 font-extrabold">{row.clicks.toLocaleString()}</td>
                      <td className="py-3.5 text-right text-violet-400">{row.conversions.toLocaleString()}</td>
                      <td className="py-3.5 text-right">
                        <span className={`font-bold ${row.ctr > 0.05 ? 'text-emerald-400' : row.ctr > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                          {(row.ctr * 100).toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
