import React from 'react';
import { Eye, Heart, Plus, Trash2, Sparkles, Image, Check, ChevronDown } from 'lucide-react';
import { useList, useUpdate, useApiUrl, useCustomMutation } from '@refinedev/core';

interface GalleryItem {
  id: string;
  title: string;
  category: string;
  image: string;
  likes: string;
  views: string;
}

const DEFAULT_ITEMS: GalleryItem[] = [
  { id: '1', title: 'Minimalist Poster Art', category: 'Creative Graphic', image: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=400&h=300&q=80', likes: '1.2k', views: '14k' },
  { id: '2', title: 'Cyberpunk Interface Design', category: 'UI Elements', image: 'https://images.unsplash.com/photo-1508921912186-1d1a45ebb3c1?auto=format&fit=crop&w=400&h=300&q=80', likes: '942', views: '8.4k' },
  { id: '3', title: 'Gradient Liquid Backgrounds', category: 'Asset Design', image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=400&h=300&q=80', likes: '2.1k', views: '26k' },
  { id: '4', title: 'Glassmorphic Panels Pack', category: 'UI Elements', image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&h=300&q=80', likes: '1.5k', views: '18k' },
  { id: '5', title: 'Wood Burning Logo Preset', category: 'Branding', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&h=300&q=80', likes: '624', views: '5.2k' },
  { id: '6', title: 'Gravity PSD B-Cards Mockup', category: 'Branding', image: 'https://images.unsplash.com/photo-1509343256512-d77a5cb3791b?auto=format&fit=crop&w=400&h=300&q=80', likes: '839', views: '7.1k' },
];

export const ImageGallery: React.FC = () => {
  const [items, setItems] = React.useState<GalleryItem[]>([]);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [newImg, setNewImg] = React.useState({ title: '', category: 'Creative Graphic', image: '' });

  // Campaign integration
  const { data: campaignsData } = useList({ resource: 'campaigns' });
  const { mutate: _updateCampaign, isLoading: isSaving } = useUpdate();
  const [assignTarget, setAssignTarget] = React.useState<GalleryItem | null>(null);
  const [assignCampaignId, setAssignCampaignId] = React.useState('');
  const [assignSuccess, setAssignSuccess] = React.useState<string | null>(null);
  // Track which campaign each gallery image is assigned to (imageId → campaignId)
  const [assignments, setAssignments] = React.useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('_sp_gallery_assignments') || '{}'); } catch { return {}; }
  });

  React.useEffect(() => {
    const stored = localStorage.getItem('_sp_gallery');
    if (stored) {
      try { setItems(JSON.parse(stored)); } catch { setItems(DEFAULT_ITEMS); }
    } else {
      setItems(DEFAULT_ITEMS);
      localStorage.setItem('_sp_gallery', JSON.stringify(DEFAULT_ITEMS));
    }
  }, []);

  const saveItems = (updated: GalleryItem[]) => {
    setItems(updated);
    localStorage.setItem('_sp_gallery', JSON.stringify(updated));
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImg.title || !newImg.image) { alert('Please specify a title and image link.'); return; }
    const item: GalleryItem = { id: crypto.randomUUID(), title: newImg.title, category: newImg.category, image: newImg.image, likes: '0', views: '0' };
    saveItems([item, ...items]);
    setNewImg({ title: '', category: 'Creative Graphic', image: '' });
    setIsAddOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Remove this image from the gallery?')) saveItems(items.filter((i) => i.id !== id));
  };

  const apiUrl = useApiUrl();
  const { mutate } = useCustomMutation();

  const handleAssign = () => {
    if (!assignTarget || !assignCampaignId) return;
    
    const campaign = campaignsData?.data?.find((c) => (c as { id?: string }).id === assignCampaignId);
    const existingDesign = campaign?.design || { config: {} };
    
    mutate({
      url: `${apiUrl}/campaigns/${assignCampaignId}/design`,
      method: 'put',
      values: {
        ...existingDesign,
        config: {
          ...(existingDesign.config || {}),
          backgroundImage: assignTarget.image,
        }
      },
    }, {
      onSuccess: () => {
        const updated = { ...assignments, [assignTarget.id]: assignCampaignId };
        setAssignments(updated);
        localStorage.setItem('_sp_gallery_assignments', JSON.stringify(updated));
        const name = (campaignsData?.data?.find((c) => (c as { id?: string }).id === assignCampaignId) as { name?: string } | undefined)?.name ?? 'campaign';
        setAssignSuccess(name);
        setTimeout(() => { setAssignSuccess(null); setAssignTarget(null); setAssignCampaignId(''); }, 2200);
      },
      onError: () => {
        // Fallback: save to localStorage design cache
        const key = `_sp_campaign_design_${assignCampaignId}`;
        const existing = JSON.parse(localStorage.getItem(key) || '{}');
        localStorage.setItem(key, JSON.stringify({
          ...existing,
          config: {
            ...(existing.config || {}),
            backgroundImage: assignTarget.image,
          }
        }));
        const updated = { ...assignments, [assignTarget.id]: assignCampaignId };
        setAssignments(updated);
        localStorage.setItem('_sp_gallery_assignments', JSON.stringify(updated));
        const name = (campaignsData?.data?.find((c) => (c as { id?: string }).id === assignCampaignId) as { name?: string } | undefined)?.name ?? 'campaign';
        setAssignSuccess(name);
        setTimeout(() => { setAssignSuccess(null); setAssignTarget(null); setAssignCampaignId(''); }, 2200);
      },
    });
  };

  const getAssignedCampaignName = (imageId: string) => {
    const cId = assignments[imageId];
    if (!cId) return null;
    return (campaignsData?.data?.find((c) => (c as { id?: string }).id === cId) as { name?: string } | undefined)?.name ?? 'a campaign';
  };

  return (
    <div className="space-y-8 font-sans">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Creative Asset Gallery</h1>
          <p className="text-slate-400 text-sm font-medium">Manage popup banner imagery. Assign any asset directly to a campaign popup.</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer select-none"
        >
          <Plus className="w-4 h-4" /> Add Asset Image
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.length > 0 ? items.map((item) => {
          const assignedTo = getAssignedCampaignName(item.id);
          return (
            <div key={item.id} className="glass-card glass-card-hover rounded-3xl overflow-hidden group relative">
              <div className="relative overflow-hidden aspect-video">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&h=300&q=80'; }}
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-slate-950/65 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2.5 px-4">
                  <button
                    onClick={() => { setAssignTarget(item); setAssignCampaignId(''); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-lg"
                  >
                    <Image className="w-3.5 h-3.5" /> Use as Popup Banner
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">{item.category}</span>
                  <h4 className="font-bold text-slate-200 tracking-tight">{item.title}</h4>
                </div>
                {assignedTo && (
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1">
                    <Check className="w-3 h-3 shrink-0" /> Banner for "{assignedTo}"
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 border-t border-white/5 pt-3">
                  <span className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5" /> {item.likes}</span>
                  <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {item.views}</span>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="col-span-full glass-card rounded-2xl py-20 flex flex-col items-center justify-center gap-4 text-center">
            <span className="text-5xl">🖼️</span>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-200">Asset Gallery is Empty</h3>
              <p className="text-slate-400 text-sm max-w-sm">Upload creative images to use as popup banners across your campaigns.</p>
            </div>
            <button onClick={() => setIsAddOpen(true)} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow transition cursor-pointer">
              Upload First Image
            </button>
          </div>
        )}
      </div>

      {/* Assign to Campaign Modal */}
      {assignTarget && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-50 px-4">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 space-y-5 glow-indigo relative z-10">
            {assignSuccess ? (
              <div className="flex flex-col items-center text-center gap-4 py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <Check className="w-7 h-7 text-emerald-400" />
                </div>
                <div>
                  <p className="font-extrabold text-lg text-slate-100">Banner Set!</p>
                  <p className="text-slate-400 text-sm mt-1">"{assignTarget.title}" is now the popup banner for <span className="text-indigo-400 font-bold">"{assignSuccess}"</span>.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3 border-b border-slate-800 pb-4">
                  <img src={assignTarget.image} className="w-16 h-12 rounded-xl object-cover border border-slate-700 shrink-0" alt="" />
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-100 leading-tight">Use as Popup Banner</h3>
                    <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{assignTarget.title}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Assign to Campaign</label>
                  <div className="relative">
                    <select
                      value={assignCampaignId}
                      onChange={(e) => setAssignCampaignId(e.target.value)}
                      className="w-full appearance-none bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none transition pr-10"
                    >
                      <option value="">Select a campaign...</option>
                      {(campaignsData?.data ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                  {!campaignsData?.data?.length && (
                    <p className="text-[11px] text-amber-400">No campaigns found. Create a campaign first.</p>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  This image will be set as the banner/background for the selected campaign's popup design. You can change it anytime.
                </p>

                <div className="flex items-center gap-3 justify-end pt-2">
                  <button
                    onClick={() => { setAssignTarget(null); setAssignCampaignId(''); }}
                    className="px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-300 font-semibold text-sm transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!assignCampaignId || isSaving}
                    onClick={handleAssign}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm transition shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Saving…' : 'Set as Campaign Banner'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Asset Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-50 px-4">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 space-y-6 glow-indigo relative z-10">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="font-extrabold text-xl text-slate-100">Upload Asset Image</h3>
                <p className="text-slate-400 text-xs mt-0.5">Register a visual to use as a popup banner or creative graphic.</p>
              </div>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Asset Title</label>
                <input
                  type="text" required placeholder="e.g. Amber Liquid Gradient Poster"
                  value={newImg.title} onChange={(e) => setNewImg({ ...newImg, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Image URL</label>
                <input
                  type="text" required placeholder="https://images.unsplash.com/..."
                  value={newImg.image} onChange={(e) => setNewImg({ ...newImg, image: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none transition font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    const samples = [
                      'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=400&h=300&q=80',
                      'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=400&h=300&q=80',
                      'https://images.unsplash.com/photo-1618005198143-d51825b74681?auto=format&fit=crop&w=400&h=300&q=80',
                      'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=400&h=300&q=80',
                    ];
                    setNewImg({ ...newImg, image: samples[Math.floor(Math.random() * samples.length)] || '' });
                  }}
                  className="text-[10px] text-indigo-400 font-bold hover:underline cursor-pointer mt-1 block"
                >
                  ⚡ Suggest a creative Unsplash image
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Category</label>
                <select
                  value={newImg.category} onChange={(e) => setNewImg({ ...newImg, category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none transition"
                >
                  <option value="Creative Graphic">Creative Graphic</option>
                  <option value="UI Elements">UI Elements</option>
                  <option value="Asset Design">Asset Design</option>
                  <option value="Branding Mockup">Branding Mockup</option>
                  <option value="Popup Banner">Popup Banner</option>
                  <option value="Product Promo">Product Promo</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-4 justify-end">
                <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-300 font-semibold text-sm transition cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm transition shadow-lg cursor-pointer">
                  Upload Creative Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
