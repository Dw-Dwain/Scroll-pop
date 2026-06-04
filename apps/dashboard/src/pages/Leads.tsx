import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Download, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { authedFetch } from '../providers/dataProvider';

interface LeadsProps {
  onNavigate: (path: string) => void;
}

interface Lead {
  id: string;
  email: string;
  name: string | null;
  campaignId: string | null;
  campaignName: string | null;
  source: string | null;
  pageUrl: string | null;
  createdAt: string;
}

interface CampaignOption {
  id: string;
  name: string;
}

const PAGE_SIZE = 50;

export function Leads(_props: LeadsProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [campaignFilter, setCampaignFilter] = useState<string>('');
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const filterQs = useMemo(
    () => (campaignFilter ? `&campaignId=${encodeURIComponent(campaignFilter)}` : ''),
    [campaignFilter],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch(`/leads?limit=${PAGE_SIZE}&offset=${offset}${filterQs}`);
      if (!res.ok) throw new Error(`Failed to load leads (${res.status})`);
      const json = await res.json();
      setLeads(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leads');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [offset, filterQs]);

  useEffect(() => { void load(); }, [load]);

  // Campaign list for the filter dropdown (best-effort).
  useEffect(() => {
    void (async () => {
      try {
        const res = await authedFetch('/campaigns?limit=100');
        if (!res.ok) return;
        const json = await res.json();
        const items = (json.data ?? []) as Array<{ id: string; name: string }>;
        setCampaigns(items.map((c) => ({ id: c.id, name: c.name })));
      } catch { /* non-fatal */ }
    })();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await authedFetch(`/leads/export?_=${Date.now()}${filterQs}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scrollpop-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this lead? This permanently removes the captured contact.')) return;
    try {
      const res = await authedFetch(`/leads/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Delete failed');
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Mail size={20} style={{ color: 'var(--accent-500)' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Leads</h1>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '2px 10px' }}>
            {total.toLocaleString()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-icon" onClick={() => void load()} title="Refresh" disabled={loading}>
            <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => void handleExport()} disabled={exporting || total === 0}>
            <Download size={14} style={{ marginRight: 6 }} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px' }}>
        Email contacts captured by your popup forms. New submissions appear here automatically.
      </p>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <select
          value={campaignFilter}
          onChange={(e) => { setOffset(0); setCampaignFilter(e.target.value); }}
          style={{
            fontSize: 13, padding: '7px 10px', borderRadius: 8, color: 'var(--text-primary)',
            background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', outline: 'none',
          }}
        >
          <option value="">All campaigns</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: 'var(--status-error)', background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Table / states */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0', fontSize: 14 }}>Loading leads…</div>
      ) : leads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
          <Mail size={36} style={{ color: 'var(--text-muted)', opacity: 0.5, marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No leads yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 380, margin: '0 auto' }}>
            When visitors submit an email through one of your popups, their details show up here — ready to export to your email tool.
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface)', textAlign: 'left' }}>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Campaign</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Captured</th>
                <th style={{ ...thStyle, width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={tdStyle}><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{l.email}</span></td>
                  <td style={tdStyle}>{l.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td style={tdStyle}>{l.campaignName || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td style={tdStyle}>{l.source || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtDate(l.createdAt)}</td>
                  <td style={tdStyle}>
                    <button className="btn btn-icon" onClick={() => void handleDelete(l.id)} title="Delete lead" style={{ color: 'var(--text-muted)' }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && total > PAGE_SIZE && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pageStart}–{pageEnd} of {total.toLocaleString()}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-icon" disabled={!canPrev} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))} title="Previous"><ChevronLeft size={15} /></button>
            <button className="btn btn-icon" disabled={!canNext} onClick={() => setOffset((o) => o + PAGE_SIZE)} title="Next"><ChevronRight size={15} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '10px 14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' };
const tdStyle: React.CSSProperties = { padding: '11px 14px', color: 'var(--text-secondary)', verticalAlign: 'middle' };
