import React from 'react';
import { Bell, Check } from 'lucide-react';
import { useApiUrl, useCustom, useCustomMutation } from '@refinedev/core';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  readAt?: string | null;
  createdAt: string;
}

function relTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  } catch { return ''; }
}

export const NotificationBell: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const apiUrl = useApiUrl();
  const [open, setOpen] = React.useState(false);

  // Poll every 30s so new notifications surface without a reload.
  const { data: res, refetch } = useCustom({
    url: `${apiUrl}/notifications`,
    method: 'get',
    queryOptions: { refetchInterval: 30000, refetchOnWindowFocus: true },
  });
  const { mutate } = useCustomMutation();

  const payload = (res as { data?: { items?: NotificationItem[]; unread?: number } } | undefined)?.data ?? { items: [], unread: 0 };
  const items: NotificationItem[] = payload.items ?? [];
  const unread: number = payload.unread ?? 0;

  const markRead = (id: string) => {
    mutate({ url: `${apiUrl}/notifications/${id}/read`, method: 'post', values: {} }, { onSuccess: () => refetch() });
  };
  const markAll = () => {
    mutate({ url: `${apiUrl}/notifications/read-all`, method: 'post', values: {} }, { onSuccess: () => refetch() });
  };
  const onItemClick = (n: NotificationItem) => {
    if (!n.readAt) markRead(n.id);
    if (n.href) { onNavigate(n.href); setOpen(false); }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn btn-icon hidden md:flex"
        title="Notifications"
        style={{ color: 'rgba(255,255,255,0.65)', position: 'relative' }}
      >
        <Bell size={15} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2, minWidth: 14, height: 14, padding: '0 3px',
            borderRadius: 7, background: 'var(--status-error, #ef4444)', color: '#fff',
            fontSize: 9, fontWeight: 700, lineHeight: '14px', textAlign: 'center',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 6, width: 340, maxWidth: '90vw',
            background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)', zIndex: 201, overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</span>
              {unread > 0 && (
                <button onClick={markAll} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--accent-300)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Check size={12} /> Mark all read
                </button>
              )}
            </div>
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {items.length === 0 ? (
                <div style={{ padding: '28px 14px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                  You're all caught up.
                </div>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => onItemClick(n)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px',
                      background: n.readAt ? 'transparent' : 'rgba(99,102,241,0.06)',
                      border: 'none', borderBottom: '1px solid var(--border-subtle)',
                      cursor: n.href ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{n.title}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{relTime(n.createdAt)}</span>
                    </div>
                    {n.body && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.4 }}>{n.body}</div>}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
