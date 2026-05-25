import React from 'react';
import { Plus, Megaphone, Play, Pause, Trash2, Eye, Calendar, Sparkles, Edit } from 'lucide-react';
import { useList, useUpdate, useDelete, useCustom, useApiUrl } from '@refinedev/core';

interface CampaignsProps {
  onNavigate: (path: string) => void;
}

type CampaignStat = { campaignId: string; impressions: number; views: number; clicks: number; conversions: number; ctr: number };

export const Campaigns: React.FC<CampaignsProps> = ({ onNavigate }) => {
  const { data: campaignsData, refetch } = useList({ resource: 'campaigns' });
  const { data: sitesData } = useList({ resource: 'sites' });

  const { mutate: updateCampaign } = useUpdate();
  const { mutate: deleteCampaign } = useDelete();

  const [isRenameOpen, setIsRenameOpen] = React.useState(false);
  const [renameCampaign, setRenameCampaign] = React.useState({ id: '', name: '' });

  const apiUrl = useApiUrl();
  const { data: analyticsResult, isLoading: analyticsLoading } = useCustom({
    url: `${apiUrl}/analytics/campaigns`,
    method: 'get',
  });

  const analyticsMap = React.useMemo<Record<string, CampaignStat>>(() => {
    const map: Record<string, CampaignStat> = {};
    const list = Array.isArray((analyticsResult as any)?.data) ? (analyticsResult as any).data : [];
    for (const s of list) map[s.campaignId] = s;
    return map;
  }, [analyticsResult]);

  const getSiteDomain = (siteId: string) => {
    const site = sitesData?.data.find((s: any) => s.id === siteId);
    return site ? site.domain : 'Unknown site';
  };

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const targetStatus = currentStatus === 'active' ? 'paused' : 'active';
    const endpointSuffix = targetStatus === 'active' ? 'activate' : 'pause';
    
    // Custom post action for activate/pause endpoints
    updateCampaign({
      resource: `campaigns/${id}/${endpointSuffix}`,
      id: '',
      values: {},
      successNotification: () => ({
        message: `Campaign status updated to ${targetStatus}!`,
        type: 'success',
      }),
    }, {
      onSuccess: () => refetch(),
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to soft delete this campaign? All analytics logs will be preserved but the campaign will be permanently archived.')) {
      deleteCampaign({
        resource: 'campaigns',
        id,
      }, {
        onSuccess: () => refetch(),
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Affiliate Campaigns</h1>
          <p className="text-slate-400 text-sm">Manage popup creatives, trigger rules, and site delivery weightings.</p>
        </div>
        <button
          onClick={() => onNavigate('/campaigns/new')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Campaign
        </button>
      </div>

      {/* Campaigns Listing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaignsData?.data && campaignsData.data.length > 0 ? (
          campaignsData.data.map((campaign: any) => {
            const domain = getSiteDomain(campaign.siteId);
            const isActive = campaign.status === 'active';
            
            const stats = analyticsMap[campaign.id];

            return (
              <div key={campaign.id} className="glass-card rounded-2xl p-6 flex flex-col justify-between gap-6 relative overflow-hidden">
                {/* Visual Accent */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${
                  campaign.status === 'active' ? 'from-emerald-500 to-teal-500' : campaign.status === 'paused' ? 'from-amber-500 to-orange-500' : 'from-slate-600 to-slate-700'
                }`}></div>

                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className="space-y-1 cursor-pointer group"
                      onClick={() => onNavigate(`/campaigns/detail/${campaign.id}`)}
                    >
                      <h4 className="font-bold text-slate-200 leading-snug group-hover:text-indigo-300 transition">{campaign.name}</h4>
                      <span className="text-xs text-slate-500 font-mono block">{domain}</span>
                    </div>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      campaign.status === 'active' 
                        ? 'bg-emerald-500/20 text-emerald-300' 
                        : campaign.status === 'paused' 
                        ? 'bg-amber-500/20 text-amber-300' 
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {campaign.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <span>Starts: {campaign.startsAt ? new Date(campaign.startsAt).toLocaleDateString() : 'Immediate'}</span>
                    </div>
                    {campaign.endsAt && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span>Ends: {new Date(campaign.endsAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Real-time analytics mini-bar */}
                <div className="grid grid-cols-3 gap-2 bg-slate-950/40 rounded-xl px-3 py-2.5 border border-slate-800/60">
                  {analyticsLoading ? (
                    <div className="col-span-3 h-4 bg-slate-800 rounded animate-pulse" />
                  ) : stats ? (
                    <>
                      <div className="text-center">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Impr.</div>
                        <div className="text-sm font-extrabold text-slate-200">{stats.impressions.toLocaleString()}</div>
                      </div>
                      <div className="text-center border-x border-slate-800/60">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Clicks</div>
                        <div className="text-sm font-extrabold text-amber-400">{stats.clicks.toLocaleString()}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">CTR</div>
                        <div className={`text-sm font-extrabold ${stats.ctr > 0.05 ? 'text-emerald-400' : stats.ctr > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                          {(stats.ctr * 100).toFixed(1)}%
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="col-span-3 text-center text-[10px] text-slate-600 font-semibold py-0.5">No events yet</div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-800/60">
                  <div className="flex items-center gap-2">
                    {campaign.status !== 'archived' && (
                      <button
                        onClick={() => handleToggleStatus(campaign.id, campaign.status)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                          isActive 
                            ? 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10' 
                            : 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                      >
                        {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {isActive ? 'Pause' : 'Activate'}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onNavigate(`/campaigns/detail/${campaign.id}`)}
                      className="p-2 text-slate-500 hover:text-emerald-400 rounded-lg hover:bg-emerald-500/10 transition cursor-pointer"
                      title="View Analytics & Telemetry"
                    >
                      <Eye className="w-4.5 h-4.5" />
                    </button>
                    
                    <button
                      onClick={() => onNavigate(`/campaigns/${campaign.id}/design`)}
                      className="p-2 text-slate-500 hover:text-indigo-400 rounded-lg hover:bg-indigo-500/10 transition cursor-pointer"
                      title="Edit Design & Triggers"
                    >
                      <Sparkles className="w-4.5 h-4.5" />
                    </button>

                    <button
                      onClick={() => {
                        setRenameCampaign({ id: campaign.id, name: campaign.name });
                        setIsRenameOpen(true);
                      }}
                      className="p-2 text-slate-500 hover:text-indigo-400 rounded-lg hover:bg-indigo-500/10 transition cursor-pointer"
                      title="Rename Campaign"
                    >
                      <Edit className="w-4.5 h-4.5" />
                    </button>
                    
                    <button
                      onClick={() => handleDelete(campaign.id)}
                      className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition cursor-pointer"
                      title="Archive Campaign"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full glass-card rounded-2xl py-16 flex flex-col items-center justify-center gap-4 text-center">
            <span className="text-4xl">📣</span>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-200">No Campaigns Created</h3>
              <p className="text-slate-400 text-sm max-w-sm">Launch a new scroll-triggered, affiliate-monetized popup campaign to start tracking conversions.</p>
            </div>
            <button
              onClick={() => onNavigate('/campaigns/new')}
              className="px-4.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow transition cursor-pointer"
            >
              Launch First Campaign
            </button>
          </div>
        )}
      </div>

      {/* Rename Campaign Modal */}
      {isRenameOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-50 px-4">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 space-y-6 glow-indigo relative z-10">
            <div className="space-y-1">
              <h3 className="font-extrabold text-xl text-slate-100">Rename Campaign</h3>
              <p className="text-slate-400 text-xs font-semibold leading-relaxed">Change the internal reference name for this creative campaign.</p>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                updateCampaign({
                  resource: 'campaigns',
                  id: renameCampaign.id,
                  values: { name: renameCampaign.name },
                  successNotification: () => ({
                    message: 'Campaign renamed successfully!',
                    type: 'success',
                  })
                }, {
                  onSuccess: () => {
                    refetch();
                    setIsRenameOpen(false);
                  }
                });
              }} 
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={renameCampaign.name}
                  onChange={(e) => setRenameCampaign({ ...renameCampaign, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none transition"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setIsRenameOpen(false)}
                  className="px-4.5 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-300 font-semibold text-sm transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm transition shadow-lg cursor-pointer"
                >
                  Rename Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
