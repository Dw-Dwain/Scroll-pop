import React, { useState, useMemo, useDeferredValue } from 'react';
import { Plus, Search, Layers, Pencil, Trash2, Play, Pause, MoreHorizontal, Download, Copy } from 'lucide-react';
import { useCustom, useCreate, useDelete, useList, useUpdate, useApiUrl } from '@refinedev/core';
import { authedFetch } from '../providers/dataProvider';
import { useActiveClient } from '../hooks/useClients';
import { DesignThumbnail } from '../components/DesignThumbnail';

interface CampaignsProps {
  onNavigate: (path: string) => void;
}

type CampaignStat = { campaignId: string; impressions: number; clicks: number; ctr: number };


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

  // Agency client scoping: the campaigns list goes through dataProvider.getList, which appends
  // `clientId` from localStorage — but Refine's cache key doesn't change on switch, so refetch
  // explicitly. The analytics overlay (useCustom) has no queryKey, so scoping its URL re-keys it.
  const { activeClientId } = useActiveClient();
  React.useEffect(() => { void refetch(); }, [activeClientId, refetch]);
  const cq = activeClientId ? `?clientId=${activeClientId}` : '';

  const { data: analyticsResult } = useCustom({ url: `${apiUrl}/analytics/campaigns${cq}`, method: 'get' });

  const analyticsMap = useMemo<Record<string, CampaignStat>>(() => {
    const map: Record<string, CampaignStat> = {};
    const rows: CampaignStat[] = Array.isArray((analyticsResult as { data?: CampaignStat[] } | undefined)?.data) ? (analyticsResult as { data: CampaignStat[] }).data : [];
    for (const row of rows) map[row.campaignId] = row;
    return map;
  }, [analyticsResult]);

  const siteById = useMemo(() => {
    const map: Record<string, { id: string; domain?: string }> = {};
    for (const s of sitesData?.data ?? []) { const r = s as { id?: string; domain?: string }; if (r?.id) map[r.id] = r as { id: string; domain?: string }; }
    return map;
  }, [sitesData]);

  const rows = useMemo(() => {
    const raw = campaignsData?.data ?? [];
    type CRow = { id: string; name: string; status?: string; createdAt?: string; config?: Record<string, unknown>; design?: Record<string, unknown>; kind?: string; siteId?: string };
    const filtered = (raw as CRow[]).filter((c) => {
      const matchQ = c.name.toLowerCase().includes(deferredQuery.toLowerCase());
      const matchS = statusFilter === 'all' || c.status === statusFilter;
      return matchQ && matchS;
    });
    const sorted = [...filtered];
    if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'ctr') sorted.sort((a, b) => (analyticsMap[b.id]?.ctr ?? 0) - (analyticsMap[a.id]?.ctr ?? 0));
    if (sortBy === 'newest') sorted.sort((a, b) => new Date(b.createdAt ?? '').getTime() - new Date(a.createdAt ?? '').getTime());
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
          onChange={(e) => setSortBy(e.target.value as 'newest' | 'name' | 'ctr')}
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
          {rows.map((c) => {
            const stats = analyticsMap[c.id];
            const site = c.siteId ? siteById[c.siteId] : undefined;
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
                <DesignThumbnail config={c.design ?? {}} status={c.status ?? 'draft'} kind={c.kind ?? 'modal'} />

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
                          JSON.stringify({ name: c.name, kind: c.kind, config: c.config ?? {} })
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
                    onClick={() => handleToggleStatus(c.id, c.status ?? 'draft')}
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
