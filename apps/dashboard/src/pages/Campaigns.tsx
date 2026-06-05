import React, { useState, useMemo, useDeferredValue } from 'react';
import { Plus, Search, Layers, Pencil, Trash2, Play, Pause, MoreHorizontal, Download, Copy } from 'lucide-react';
import { useCustom, useCreate, useDelete, useList, useUpdate, useApiUrl } from '@refinedev/core';
import { authedFetch } from '../providers/dataProvider';

interface CampaignsProps {
  onNavigate: (path: string) => void;
}

type CampaignStat = { campaignId: string; impressions: number; clicks: number; ctr: number };

// ── Mini popup preview thumbnail ───────────────────────────────────────────────
function PopupPreview({ kind, status }: { kind: string; status: string }) {
  const palette: Record<string, { bg: string; accent: string }> = {
    modal:      { bg: '#f5f3ff', accent: '#6366f1' },
    bar:        { bg: '#f0fdf4', accent: '#22c55e' },
    banner:     { bg: '#fff7ed', accent: '#f59e0b' },
    fullscreen: { bg: '#fdf4ff', accent: '#a855f7' },
    floating:   { bg: '#eff6ff', accent: '#3b82f6' },
    spin_wheel: { bg: '#fdf2ff', accent: '#8b5cf6' },
  };
  const { bg, accent } = palette[kind] ?? { bg: '#f4f4f5', accent: '#6366f1' };

  return (
    <div style={{
      height: 130,
      background: bg,
      borderRadius: '8px 8px 0 0',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* mock page lines */}
      <div style={{ position: 'absolute', inset: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 5, pointerEvents: 'none' }}>
        <div style={{ height: 5, background: 'rgba(0,0,0,0.08)', borderRadius: 3, width: '65%' }} />
        <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 3, width: '45%' }} />
        <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 3, width: '55%' }} />
        <div style={{ height: 4, background: 'rgba(0,0,0,0.05)', borderRadius: 3, width: '40%', marginTop: 2 }} />
      </div>

      {/* popup shape */}
      {kind === 'bar' ? (
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, height: 22, background: accent, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 8, color: '#fff', fontWeight: 700, letterSpacing: '0.06em', fontFamily: 'monospace' }}>ANNOUNCEMENT BAR</span>
        </div>
      ) : kind === 'floating' ? (
        <div style={{ position: 'absolute', bottom: 14, right: 14, width: 56, height: 30, background: accent, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.18)' }}>
          <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>⚡ offer</span>
        </div>
      ) : kind === 'fullscreen' ? (
        <div style={{ position: 'absolute', inset: 6, background: accent, borderRadius: 4, opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 9, color: '#fff', fontWeight: 700, letterSpacing: '0.04em' }}>FULLSCREEN</span>
        </div>
      ) : kind === 'spin_wheel' ? (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
          <svg width="70" height="70" viewBox="0 0 70 70">
            {[0,1,2,3,4,5].map((i) => {
              const colors = ['#8b5cf6','#a78bfa','#c4b5fd','#7c3aed','#6d28d9','#ddd6fe'];
              const slice = (Math.PI * 2) / 6;
              const start = i * slice - Math.PI / 2;
              const end = start + slice;
              const r = 32, cx = 35, cy = 35;
              const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
              const x2 = cx + r * Math.cos(end),   y2 = cy + r * Math.sin(end);
              return (
                <g key={i}>
                  <path d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`} fill={colors[i]} stroke="#fff" strokeWidth="1.5" />
                  <text x={cx + (r * 0.62) * Math.cos(start + slice / 2)} y={cy + (r * 0.62) * Math.sin(start + slice / 2)} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="6" fontWeight="bold">
                    {['10%','Free','20%','5%','Ship','15%'][i]}
                  </text>
                </g>
              );
            })}
            <circle cx="35" cy="35" r="5" fill="#fff" />
            <polygon points="35,1 32,9 38,9" fill="#f59e0b" />
          </svg>
          <div style={{ textAlign: 'center', fontSize: 8, fontWeight: 700, color: accent, marginTop: 2, letterSpacing: '0.04em' }}>SPIN TO WIN</div>
        </div>
      ) : (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 88, height: 62, background: '#fff', borderRadius: 7, boxShadow: '0 4px 20px rgba(0,0,0,0.14)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ height: 9, background: accent }} />
          <div style={{ flex: 1, padding: '5px 7px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ height: 3, background: '#e5e7eb', borderRadius: 1, width: '80%' }} />
            <div style={{ height: 3, background: '#f3f4f6', borderRadius: 1, width: '60%' }} />
            <div style={{ height: 7, background: accent, borderRadius: 3, marginTop: 4, opacity: 0.9 }} />
          </div>
        </div>
      )}
    </div>
  );
}
function CampaignThumbnail({ config, status, kind }: { config: any; status: string; kind?: string }) {
  const mainStep = Array.isArray(config?.steps)
    ? config.steps.find((s: any) => s.id === 'main')
    : config?.steps?.main;
  
  if (!mainStep) {
    return <PopupPreview kind={kind ?? 'modal'} status={status} />;
  }

  // Calculate scale to fit inside 130px height, ~280px width
  const containerW = 280;
  const containerH = 130;
  
  // padding
  const availW = containerW - 40;
  const availH = containerH - 40;

  const scaleX = availW / mainStep.width;
  const scaleY = availH / mainStep.height;
  const scale = Math.min(scaleX, scaleY, 1);

  return (
    <div style={{
      height: 130,
      background: 'var(--bg-raised)',
      borderRadius: '8px 8px 0 0',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Background checkerboard pattern to look like canvas */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.3, backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 0)', backgroundSize: '12px 12px' }} />
      
      <div style={{
        width: mainStep.width,
        height: mainStep.height,
        backgroundColor: mainStep.backgroundColor || '#ffffff',
        borderRadius: mainStep.borderRadius || 0,
        position: 'relative',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        flexShrink: 0,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        zIndex: 1,
      }}>
        {mainStep.elements?.map((el: any) => (
          <div
            key={el.id}
            style={{
              position: 'absolute',
              left: `${el.x}%`,
              top: `${el.y}%`,
              width: `${el.w}%`,
              height: `${el.h}%`,
              zIndex: el.zIndex,
            }}
          >
            {el.type === 'heading' && (
              <h2 style={{ width: '100%', height: '100%', margin: 0, color: el.color, fontSize: `${el.fontSize || 22}px`, fontFamily: el.fontFamily, textAlign: el.align || 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', wordBreak: 'break-word', fontWeight: 800 }}>
                {el.content}
              </h2>
            )}
            {el.type === 'text' && (
              <p style={{ width: '100%', height: '100%', margin: 0, color: el.color, fontSize: `${el.fontSize || 12}px`, fontFamily: el.fontFamily, textAlign: el.align || 'left', backgroundColor: el.backgroundColor || 'transparent', borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined, borderWidth: el.borderWidth ? `${el.borderWidth}px` : undefined, borderColor: el.borderColor, padding: el.padding ? `${el.padding}px` : undefined }}>
                {el.content}
              </p>
            )}
            {el.type === 'button' && (
              <button style={{ width: '100%', height: '100%', border: 'none', backgroundColor: el.backgroundColor || '#000000', color: el.color || '#FFFFFF', borderRadius: `${el.borderRadius ?? 8}px`, fontSize: `${el.fontSize || 11}px`, fontFamily: el.fontFamily, fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {el.content}
              </button>
            )}
            {el.type === 'input' && (
              <input readOnly placeholder={el.extraProps?.placeholder || 'Email...'} style={{ width: '100%', height: '100%', border: '1px solid #e4e4e7', backgroundColor: '#fff', borderRadius: `${el.borderRadius ?? 8}px`, fontSize: '12px', padding: '0 8px', pointerEvents: 'none' }} />
            )}
            {el.type === 'shape' && el.content === 'wheel' && (
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '3px solid #18181b', background: 'conic-gradient(#09090b 0 51deg, #18181b 51deg 102deg, #27272a 102deg 153deg, #3f3f46 153deg 204deg, #52525b 204deg 255deg, #71717a 255deg 306deg, #e4e4e7 306deg 360deg)' }} />
            )}
            {el.type === 'image' && el.content && (
              <img src={el.content} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined }} />
            )}
          </div>
        ))}
      </div>

      {/* status badge */}
      <div style={{
        position: 'absolute', top: 8, left: 8,
        padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 600,
        fontFamily: 'monospace', letterSpacing: '0.05em', textTransform: 'uppercase',
        background: status === 'active' ? 'rgba(34,197,94,0.12)' : status === 'paused' ? 'rgba(245,158,11,0.12)' : 'rgba(113,113,122,0.1)',
        color: status === 'active' ? '#16a34a' : status === 'paused' ? '#d97706' : '#71717a',
        border: `1px solid ${status === 'active' ? 'rgba(34,197,94,0.2)' : status === 'paused' ? 'rgba(245,158,11,0.2)' : 'rgba(113,113,122,0.2)'}`,
        zIndex: 10
      }}>
        {status ?? 'draft'}
      </div>
    </div>
  );
}

export const Campaigns: React.FC<CampaignsProps> = ({ onNavigate }) => {
  const { data: campaignsData, refetch, isLoading } = useList({ resource: 'campaigns' });
  const { data: sitesData } = useList({ resource: 'sites' });
  const { mutate: updateCampaign } = useUpdate();
  const { mutate: deleteCampaign } = useDelete();
  const { mutate: createResource } = useCreate();
  const apiUrl = useApiUrl();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'draft'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'ctr'>('newest');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data: analyticsResult } = useCustom({ url: `${apiUrl}/analytics/campaigns`, method: 'get' });

  const analyticsMap = useMemo<Record<string, CampaignStat>>(() => {
    const map: Record<string, CampaignStat> = {};
    const rows = Array.isArray((analyticsResult as any)?.data) ? (analyticsResult as any).data : [];
    for (const row of rows) map[row.campaignId] = row;
    return map;
  }, [analyticsResult]);

  const siteById = useMemo(() => {
    const map: Record<string, any> = {};
    for (const s of sitesData?.data ?? []) if (s?.id) map[s.id] = s;
    return map;
  }, [sitesData]);

  const rows = useMemo(() => {
    const raw = campaignsData?.data ?? [];
    const filtered = raw.filter((c: any) => {
      const matchQ = c.name.toLowerCase().includes(deferredQuery.toLowerCase());
      const matchS = statusFilter === 'all' || c.status === statusFilter;
      return matchQ && matchS;
    });
    const sorted = [...filtered];
    if (sortBy === 'name') sorted.sort((a: any, b: any) => a.name.localeCompare(b.name));
    if (sortBy === 'ctr') sorted.sort((a: any, b: any) => (analyticsMap[b.id]?.ctr ?? 0) - (analyticsMap[a.id]?.ctr ?? 0));
    if (sortBy === 'newest') sorted.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sorted;
  }, [campaignsData, deferredQuery, statusFilter, sortBy, analyticsMap]);

  const handleToggleStatus = (id: string, currentStatus: string) => {
    updateCampaign(
      { resource: `campaigns/${id}/${currentStatus === 'active' ? 'pause' : 'activate'}`, id: '', values: {} },
      { onSuccess: () => refetch() }
    );
  };

  const handleDownload = async (id: string, name?: string) => {
    try {
      const res = await authedFetch(`/campaigns/${id}/export`);
      if (!res.ok) { alert('Could not export campaign data. Please try again.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scrollpop-${(name || 'campaign').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('Could not export campaign data. Please try again.');
    }
  };

  const handleDuplicate = (id: string) => {
    // Clones the campaign (+ design, triggers, targeting, frequency) as a new draft.
    createResource(
      { resource: `campaigns/${id}/duplicate`, values: {} },
      {
        onSuccess: () => refetch(),
        onError: () => alert('Could not duplicate campaign. Please try again.'),
      }
    );
  };

  const handleDelete = (id: string) => {
    // The 24h grace window: data stays downloadable for 24h after deletion, then is purged.
    if (confirm('Delete this campaign?\n\nIts analytics data stays downloadable for 24 hours, then is permanently purged. You can export it now or within that window via "Download data".')) {
      deleteCampaign({ resource: 'campaigns', id }, { onSuccess: () => refetch() });
    }
  };

  return (
    <div style={{ maxWidth: 1400, width: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, marginBottom: 4, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Campaigns</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            {rows.length} campaign{rows.length !== 1 ? 's' : ''}
            {statusFilter !== 'all' ? ` · ${statusFilter}` : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('/campaigns/new')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} />
          New Campaign
        </button>
      </div>

      {/* Filter strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'var(--bg-raised)', borderRadius: 6, padding: 2, gap: 1 }}>
          {(['all', 'active', 'paused', 'draft'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '4px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: statusFilter === s ? 'var(--bg-raised)' : 'transparent',
                color: statusFilter === s ? 'var(--text-primary)' : 'var(--text-muted)',
                border: statusFilter === s ? '1px solid var(--border-subtle)' : '1px solid transparent',
                borderRadius: 4, textTransform: 'capitalize',
                boxShadow: statusFilter === s ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.1s',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <select
          className="input"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          style={{ maxWidth: 140 }}
        >
          <option value="newest">Newest first</option>
          <option value="name">Name A→Z</option>
          <option value="ctr">Highest CTR</option>
        </select>

        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 30, width: '100%' }}
            placeholder="Search campaigns…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton" style={{ height: 240, borderRadius: 8 }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8,
          padding: '56px 24px', textAlign: 'center',
        }}>
          <Layers size={28} style={{ color: 'var(--text-muted)', display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
            {campaignsData?.data?.length === 0 ? 'No campaigns yet.' : 'No campaigns match your filters.'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            {campaignsData?.data?.length === 0 ? 'Create your first campaign to start driving conversions.' : 'Try adjusting your search or filters.'}
          </p>
          {campaignsData?.data?.length === 0 ? (
            <button className="btn btn-primary" onClick={() => onNavigate('/campaigns/new')}>
              Create Campaign
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => { setQuery(''); setStatusFilter('all'); }}>
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {rows.map((c: any) => {
            const stats = analyticsMap[c.id];
            const site = siteById[c.siteId];
            const isMenuOpen = openMenuId === c.id;

            return (
              <div
                key={c.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                }}
              >
                {/* Popup preview thumbnail */}
                <CampaignThumbnail config={c.design} status={c.status ?? 'draft'} kind={c.kind ?? 'modal'} />

                {/* Card body */}
                <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Name + site */}
                  <div>
                    <button
                      onClick={() => onNavigate(`/campaigns/detail/${c.id}`)}
                      style={{
                        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                        fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                        textAlign: 'left', display: 'block', marginBottom: 3,
                        lineHeight: '1.3',
                      }}
                    >
                      {c.name}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      <span>{site?.domain ?? '—'}</span>
                      {c.kind && (
                        <>
                          <span style={{ opacity: 0.4 }}>·</span>
                          <span style={{ textTransform: 'capitalize', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                            {c.kind.replace(/_/g, ' ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 16, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Impr.</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {stats?.impressions != null ? stats.impressions.toLocaleString() : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CTR</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: stats?.ctr ? 'var(--accent-500)' : 'var(--text-primary)' }}>
                        {stats?.ctr != null ? `${(stats.ctr * 100).toFixed(1)}%` : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action footer */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '8px 12px',
                  borderTop: '1px solid var(--border-subtle)',
                  background: 'var(--bg-raised)',
                }}>
                  <button
                    onClick={() => {
                      // Spin-to-win has no visual editor template — its design (wheel slices,
                      // colours) and settings live on the campaign detail page. Route there
                      // instead of the canvas editor so the user lands on the right screen.
                      if (c.kind === 'spin_wheel') {
                        onNavigate(`/campaigns/detail/${c.id}`);
                        return;
                      }
                      // Cache campaign data so the designer can restore it without the API
                      try {
                        sessionStorage.setItem(
                          `sp_campaign_${c.id}`,
                          JSON.stringify({ name: c.name, kind: c.kind, config: (c as any).config ?? {} })
                        );
                      } catch {}
                      onNavigate(`/campaigns/${c.id}/design`);
                    }}
                    className="btn btn-sm btn-secondary"
                    style={{ flex: 1, justifyContent: 'center', gap: 5, fontSize: 11 }}
                    title={c.kind === 'spin_wheel' ? 'Customize wheel & settings' : 'Edit design'}
                  >
                    <Pencil size={12} />
                    {c.kind === 'spin_wheel' ? 'Customize' : 'Edit Design'}
                  </button>

                  <button
                    onClick={() => handleToggleStatus(c.id, c.status)}
                    className="btn btn-icon"
                    title={c.status === 'active' ? 'Pause campaign' : 'Activate campaign'}
                    style={{ color: c.status === 'active' ? 'var(--status-warning)' : 'var(--status-success)' }}
                  >
                    {c.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                  </button>

                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setOpenMenuId(isMenuOpen ? null : c.id)}
                      className="btn btn-icon"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {isMenuOpen && (
                      <div style={{
                        position: 'absolute', right: 0, bottom: '100%', marginBottom: 4,
                        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                        borderRadius: 6, minWidth: 140, zIndex: 50,
                        boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
                      }}>
                        <button
                          onClick={() => { onNavigate(`/campaigns/detail/${c.id}`); setOpenMenuId(null); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--text-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-raised)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          View details
                        </button>
                        <button
                          onClick={() => { void handleDownload(c.id, c.name); setOpenMenuId(null); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--text-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-raised)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <Download size={12} style={{ marginRight: 6, display: 'inline' }} />
                          Download data
                        </button>
                        <button
                          onClick={() => { handleDuplicate(c.id); setOpenMenuId(null); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--text-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-raised)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <Copy size={12} style={{ marginRight: 6, display: 'inline' }} />
                          Duplicate
                        </button>
                        <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                        <button
                          onClick={() => { handleDelete(c.id); setOpenMenuId(null); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--status-error)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.05)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <Trash2 size={12} style={{ marginRight: 6, display: 'inline' }} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
