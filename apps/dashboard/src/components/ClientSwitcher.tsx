import React from 'react';
import { Briefcase, ChevronDown, Check, Plus, Trash2, Loader2 } from 'lucide-react';
import { useClients, useActiveClient } from '../hooks/useClients';
import { authedFetch } from '../providers/dataProvider';

/**
 * Agency client-workspace switcher for the top nav. Switching the active client
 * re-scopes client-aware pages (Sites today; campaigns/analytics follow the same
 * key). Hidden entirely for non-agency tenants.
 */
export const ClientSwitcher: React.FC = () => {
  const { clients, isAgency, isLoading, refetch } = useClients();
  const { activeClientId, setActiveClient } = useActiveClient();
  const [open, setOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setAdding(false); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!isAgency) return null;

  const active = clients.find((c) => c.id === activeClientId);
  const label = active ? active.name : 'All clients';

  const createClient = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const res = await authedFetch('/clients', { method: 'POST', body: JSON.stringify({ name }) });
      if (res.ok) {
        const body = await res.json() as { data: { id: string } };
        setNewName('');
        setAdding(false);
        await refetch();
        setActiveClient(body.data.id);
      } else if (res.status === 403) {
        alert('Only the agency owner can add clients.');
      }
    } finally {
      setBusy(false);
    }
  };

  const removeClient = async (id: string, name: string) => {
    if (busy) return;
    if (!confirm(`Delete client "${name}"? Its sites become unassigned (not deleted).`)) return;
    setBusy(true);
    try {
      const res = await authedFetch(`/clients/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeClientId === id) setActiveClient('');
        await refetch();
      } else if (res.status === 403) {
        alert('Only the agency owner can delete clients.');
      }
    } finally {
      setBusy(false);
    }
  };

  const rowBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '7px 10px', borderRadius: 5, fontSize: 12.5,
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
    color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
  };

  return (
    <div ref={ref} style={{ position: 'relative', marginRight: 16, flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Switch client workspace"
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '5px 10px', borderRadius: 6,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          cursor: 'pointer', color: 'rgba(255,255,255,0.85)',
          fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
          maxWidth: 200, whiteSpace: 'nowrap',
        }}
      >
        <Briefcase size={13} style={{ flexShrink: 0, opacity: 0.8 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <ChevronDown size={12} style={{ flexShrink: 0, opacity: 0.5, transition: 'transform 150ms', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          minWidth: 248, maxHeight: 380, overflowY: 'auto',
          background: 'var(--bg-raised)', border: '1px solid var(--border-default)',
          borderRadius: 8, padding: 4, zIndex: 200,
          boxShadow: '0 4px 24px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <div style={{ padding: '6px 10px 4px', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Client workspace
          </div>

          {/* All clients */}
          <button
            onClick={() => { setActiveClient(''); setOpen(false); }}
            className="nav-item"
            style={{ ...rowBase, background: !activeClientId ? 'var(--bg-overlay)' : 'none' }}
          >
            <Briefcase size={14} style={{ opacity: 0.7 }} />
            <span style={{ flex: 1 }}>All clients</span>
            {!activeClientId && <Check size={14} style={{ color: 'var(--accent-500)' }} />}
          </button>

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }}>
              <Loader2 size={13} className="spin" /> Loading…
            </div>
          )}

          {clients.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                onClick={() => { setActiveClient(c.id); setOpen(false); }}
                className="nav-item"
                style={{ ...rowBase, flex: 1, background: activeClientId === c.id ? 'var(--bg-overlay)' : 'none' }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{c.siteCount} {c.siteCount === 1 ? 'site' : 'sites'}</span>
                {activeClientId === c.id && <Check size={14} style={{ color: 'var(--accent-500)' }} />}
              </button>
              <button
                onClick={() => removeClient(c.id, c.name)}
                title="Delete client"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 5, color: 'var(--text-muted)', flexShrink: 0 }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--status-error)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

          {adding ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px' }}>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void createClient(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
                placeholder="Client name"
                style={{
                  flex: 1, padding: '6px 8px', fontSize: 12.5, borderRadius: 5,
                  border: '1px solid var(--border-default)', background: 'var(--bg-base)', color: 'var(--text-primary)',
                }}
              />
              <button
                onClick={() => void createClient()}
                disabled={busy || !newName.trim()}
                style={{ padding: '6px 10px', fontSize: 12, fontWeight: 600, borderRadius: 5, border: 'none', cursor: 'pointer', background: 'var(--accent-500)', color: '#fff', opacity: busy || !newName.trim() ? 0.5 : 1 }}
              >
                {busy ? <Loader2 size={13} className="spin" /> : 'Add'}
              </button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="nav-item" style={{ ...rowBase, color: 'var(--accent-400)' }}>
              <Plus size={14} />
              <span>New client</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
