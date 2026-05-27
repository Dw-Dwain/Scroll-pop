import React from 'react';
import { Eye, Pause, Play, Sparkles, Trash2, MoreVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CampaignCardProps {
  campaign: any;
  stats: { impressions: number; clicks: number; ctr: number } | undefined;
  siteDomain: string;
  onToggleStatus: (id: string, currentStatus: string) => void;
  onViewDetails: (id: string) => void;
  onEditDesign: (id: string) => void;
  onDelete: (id: string) => void;
}

export const CampaignCard = React.memo(function CampaignCard({
  campaign,
  stats,
  siteDomain,
  onToggleStatus,
  onViewDetails,
  onEditDesign,
  onDelete,
}: CampaignCardProps) {
  const isActive = campaign.status === 'active';
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-4 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group relative flex flex-col h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 dark:text-white truncate">{campaign.name}</h3>
          <p className="text-xs text-slate-500 font-mono truncate mt-0.5">{siteDomain}</p>
        </div>
        <span className={cn(
          "text-[10px] px-2 py-1 rounded-full uppercase font-bold flex-shrink-0",
          isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
        )}>
          {campaign.status}
        </span>
      </div>

      <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 grid grid-cols-3 text-center mt-auto">
        <div className="flex flex-col items-center justify-center border-r border-slate-200 dark:border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Impr</p>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{stats?.impressions?.toLocaleString?.() ?? 0}</p>
        </div>
        <div className="flex flex-col items-center justify-center border-r border-slate-200 dark:border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Clicks</p>
          <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{stats?.clicks?.toLocaleString?.() ?? 0}</p>
        </div>
        <div className="flex flex-col items-center justify-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">CTR</p>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{(((stats?.ctr ?? 0) * 100)).toFixed(1)}%</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button 
          onClick={() => onToggleStatus(campaign.id, campaign.status)} 
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center w-28",
            isActive 
              ? "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-500/10" 
              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
          )}
        >
          {isActive ? <Pause className="w-3.5 h-3.5 mr-1.5" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
          {isActive ? 'Pause' : 'Activate'}
        </button>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
          <button onClick={() => onViewDetails(campaign.id)} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="View Details">
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={() => onEditDesign(campaign.id)} className="p-2 rounded-lg text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Edit Design">
            <Sparkles className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(campaign.id)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
