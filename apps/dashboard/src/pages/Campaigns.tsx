import React, { useState, useMemo, useDeferredValue } from 'react';
import { Plus, Search, Layers, Pencil, Trash2, MoreHorizontal, Play, Pause } from 'lucide-react';
import { useCustom, useDelete, useList, useUpdate, useApiUrl } from '@refinedev/core';

interface CampaignsProps {
  onNavigate: (path: string) => void;
}

type CampaignStat = { campaignId: string; impressions: number; clicks: number; ctr: number };

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'active' ? 'var(--status-success)' :
    status === 'paused' ? 'var(--status-warning)' :
    'var(--text-muted)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
      <span style={{ textTransform: 'capitalize', color: 'var(--text-muted)', fontSize: 11 }}>{status ?? 'draft'}</span>
    </span>
  );
}

export const Campaigns: React.FC<CampaignsProps> = ({ onNavigate }) => {
  const { data: campaignsData, refetch, isLoading } = useList({ resource: 'campaigns' });
  const { data: sitesData } = useList({ resource: 'sites' });
  const { mutate: updateCampaign } = useUpdate();
  const { mutate: deleteCampaign } = useDelete();
  const apiUrl = useApiUrl();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'draft'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'ctr'>('newest');
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  const allSelected = rows.length > 0 && rows.every((r: any) => selected.has(r.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r: any) => r.id)));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleToggleStatus = (id: string, currentStatus: string) => {
    updateCampaign(
      { resource: `campaigns/${id}/${currentStatus === 'active' ? 'pause' : 'activate'}`, id: '', values: {} },
      { onSuccess: () => refetch() }
    );
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this campaign?')) {
      deleteCampaign({ resource: 'campaigns', id }, { onSuccess: () => refetch() });
    }
  };

  const handleBulkDelete = () => {
    if (!confirm(`Delete ${selected.size} campaign(s)?`)) return;
    selected.forEach((id) => deleteCampaign({ resource: 'campaigns', id }, { onSuccess: () => refetch() }));
    setSelected(new Set());
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, marginBottom: 4, letterSpacing: '-0.01em' }}>Campaigns</h1>
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Status filter */}
        <div style={{ display: 'flex', border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden' }}>
          {(['all', 'active', 'paused', 'draft'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: statusFilter === s ? 'var(--bg-raised)' : 'transparent',
                color: statusFilter === s ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none', textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Sort */}
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

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
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

      {/* Table */}
      {isLoading ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 48, margin: '1px 0', borderRadius: 0 }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8,
          padding: '48px 24px', textAlign: 'center',
        }}>
          <Layers size={28} style={{ color: 'var(--text-muted)', display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
            {campaignsData?.data?.length === 0 ? 'No campaigns yet.' : 'No campaigns match your filters.'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            {campaignsData?.data?.length === 0 ? 'Create your first campaign to get started.' : 'Try adjusting your search or filters.'}
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
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ width: 40, padding: '10px 12px' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    style={{ accentColor: 'var(--accent-500)', cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Campaign
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Site
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Format
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Impr.
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  CTR
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Created
                </th>
                <th style={{ width: 80, padding: '10px 16px' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((c: any) => {
                const stats = analyticsMap[c.id];
                const site = siteById[c.siteId];
                const isChecked = selected.has(c.id);
                return (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isChecked ? 'rgba(99,102,241,0.04)' : 'transparent',
                      height: 48,
                    }}
                  >
                    <td style={{ padding: '0 12px', width: 40 }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(c.id)}
                        style={{ accentColor: 'var(--accent-500)', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '0 16px' }}>
                      <div>
                        <button
                          onClick={() => onNavigate(`/campaigns/detail/${c.id}`)}
                          style={{
                            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                            fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', display: 'block',
                          }}
                        >
                          {c.name}
                        </button>
                        <StatusDot status={c.status ?? 'draft'} />
                      </div>
                    </td>
                    <td style={{ padding: '0 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {site?.domain ?? '—'}
                    </td>
                    <td style={{ padding: '0 16px' }}>
                      <span style={{
                        fontSize: 11, padding: '2px 7px', borderRadius: 3,
                        background: 'var(--bg-raised)', color: 'var(--text-muted)',
                        textTransform: 'capitalize',
                      }}>
                        {c.kind?.replace(/_/g, ' ') ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '0 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {stats?.impressions?.toLocaleString() ?? '—'}
                    </td>
                    <td style={{ padding: '0 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: stats?.ctr ? 'var(--accent-300)' : 'var(--text-muted)' }}>
                      {stats?.ctr != null ? `${(stats.ctr * 100).toFixed(2)}%` : '—'}
                    </td>
                    <td style={{ padding: '0 16px', fontSize: 11, color: 'var(--text-muted)' }}>
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '0 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleToggleStatus(c.id, c.status)}
                          className="btn btn-icon"
                          title={c.status === 'active' ? 'Pause' : 'Activate'}
                        >
                          {c.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                        </button>
                        <button
                          onClick={() => onNavigate(`/campaigns/${c.id}/design`)}
                          className="btn btn-icon"
                          title="Edit design"
                        >
                          <Pencil size={13} />
                        </button>
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                            className="btn btn-icon"
                          >
                            <MoreHorizontal size={13} />
                          </button>
                          {openMenuId === c.id && (
                            <div style={{
                              position: 'absolute', right: 0, top: '100%', marginTop: 4,
                              background: 'var(--bg-overlay)', border: '1px solid var(--border-default)',
                              borderRadius: 6, minWidth: 140, zIndex: 50,
                              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                            }}>
                              <button
                                onClick={() => { onNavigate(`/campaigns/detail/${c.id}`); setOpenMenuId(null); }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                View details
                              </button>
                              <button
                                onClick={() => { handleDelete(c.id); setOpenMenuId(null); }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--status-error)', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-overlay)', border: '1px solid var(--border-default)',
          borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 50, minWidth: 320,
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {selected.size} selected
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setSelected(new Set())}
            className="btn btn-ghost btn-sm"
          >
            Deselect all
          </button>
          <button
            onClick={handleBulkDelete}
            className="btn btn-sm"
            style={{ color: 'var(--status-error)', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)' }}
          >
            <Trash2 size={13} />
            Delete {selected.size}
          </button>
        </div>
      )}
    </div>
  );
};
