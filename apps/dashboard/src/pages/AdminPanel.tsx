import React from 'react';
import { Shield, Users, Mail, CreditCard, Globe, Megaphone, Activity, RefreshCw, Lock } from 'lucide-react';
import { usePlan, ADMIN_EMAIL, PLAN_PRICES } from '../hooks/usePlan';
import { useCustom, useCustomMutation } from '@refinedev/core';
import { getApiBase } from '../providers/dataProvider';
import type { PlanId } from '../hooks/usePlan';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
  plan?: PlanId;
  orgName?: string;
  siteCount?: number;
  campaignCount?: number;
  createdAt?: string;
}

interface AdminPanelProps {
  onNavigate: (path: string) => void;
}

const PLAN_COLORS: Record<string, { bg: string; color: string }> = {
  free:    { bg: 'rgba(113,113,122,0.12)', color: 'var(--text-muted)' },
  starter: { bg: 'rgba(14,165,233,0.12)',  color: '#38bdf8' },
  growth:  { bg: 'rgba(99,102,241,0.12)',  color: 'var(--accent-300)' },
  scale:   { bg: 'rgba(139,92,246,0.12)',  color: '#c084fc' },
  agency:  { bg: 'rgba(245,158,11,0.12)',  color: '#fbbf24' },
  admin:   { bg: 'rgba(34,197,94,0.12)',   color: 'var(--status-success)' },
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ onNavigate }) => {
  const { isAdmin } = usePlan();

  // Hard gate — render nothing useful until the API confirms admin status.
  // isAdmin is only true when the verified API email === ADMIN_EMAIL.
  // This prevents any logged-in user from seeing the admin UI.
  if (!isAdmin) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: 16, padding: 40,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Lock size={24} style={{ color: 'var(--status-error)' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            Access Restricted
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 320 }}>
            This area is only accessible to the ScrollPop system administrator.
          </div>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onNavigate('/dashboard')}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const [search, setSearch] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'tenants' | 'system'>('tenants');

  // Fetch all tenants + platform stats from the real admin API (Clerk-authenticated).
  const { data: tenantsData, isLoading: loading, isError, refetch } = useCustom({
    url: `${getApiBase()}/admin/tenants`,
    method: 'get',
    queryOptions: { staleTime: 30_000 },
  });
  const { data: statsData } = useCustom({
    url: `${getApiBase()}/admin/stats`,
    method: 'get',
    queryOptions: { staleTime: 30_000 },
  });

  const users: AdminUser[] = ((tenantsData?.data as any) ?? []).map((t: any) => ({
    id: t.id,
    email: t.email ?? '—',
    name: t.ownerName ?? t.name ?? '—',
    role: 'owner',
    plan: t.plan as PlanId,
    orgName: t.name,
    siteCount: t.siteCount ?? 0,
    campaignCount: t.campaignCount ?? 0,
    createdAt: t.createdAt,
  }));

  const error = isError ? 'Failed to load tenant list. Check API logs.' : '';
  const fetchUsers = () => { refetch(); };

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center', gap: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 10, background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--status-error)',
        }}>
          <Lock size={20} />
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Access Denied</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 280, margin: 0 }}>
          This area is restricted to master administrators only.
        </p>
        <button className="btn btn-secondary" onClick={() => onNavigate('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const filtered = users.filter((u) =>
    (u.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.orgName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    paid: users.filter((u) => u.plan && u.plan !== 'free').length,
    mrr: users.reduce((sum, u) => {
      const price = u.plan ? parseFloat(PLAN_PRICES[u.plan]?.replace('$', '') ?? '0') : 0;
      return sum + price;
    }, 0),
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>Admin Console</h1>
            <span className="badge badge-warning" style={{ fontSize: 9 }}>restricted</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Full visibility across all accounts. Logged in as {ADMIN_EMAIL}.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Tenants', value: stats.total, icon: Users,       color: 'var(--data-1)' },
          { label: 'Paid Accounts', value: stats.paid,  icon: CreditCard,  color: 'var(--status-success)' },
          { label: 'Est. MRR',      value: `$${stats.mrr.toLocaleString()}`, icon: Activity, color: 'var(--data-3)' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon size={14} style={{ color }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 500, color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-subtle)', marginBottom: 20 }}>
        {(['tenants', 'system'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--accent-500)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              textTransform: 'capitalize', marginBottom: -1,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'tenants' && (
        <>
          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 320, marginBottom: 16 }}>
            <Shield size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 30, width: '100%' }}
              placeholder="Search by name, email, or org…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {error ? (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '16px 20px', color: 'var(--status-error)', fontSize: 13 }}>
              {error}
            </div>
          ) : loading ? (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: 52, margin: '1px 0', borderRadius: 0 }} />
              ))}
            </div>
          ) : (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['User', 'Organization', 'Plan', 'Sites', 'Campaigns', 'Joined'].map((h) => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                        No users match your search.
                      </td>
                    </tr>
                  ) : filtered.map((u) => {
                    const planKey = u.role === 'admin' ? 'admin' : (u.plan ?? 'free');
                    const planStyle = PLAN_COLORS[planKey] ?? PLAN_COLORS['free']!;
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)', height: 52 }}>
                        <td style={{ padding: '0 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-subtle)' }} alt="" />
                            ) : (
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                                {u.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                {u.name}
                                {u.role === 'admin' && <Shield size={11} style={{ color: '#fbbf24' }} />}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Mail size={10} /> {u.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                          {u.orgName ?? '—'}
                        </td>
                        <td style={{ padding: '0 16px' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 3,
                            background: planStyle.bg, color: planStyle.color,
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>
                            {u.role === 'admin' ? 'Admin' : (u.plan ?? 'free')}
                          </span>
                        </td>
                        <td style={{ padding: '0 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Globe size={12} /> {u.siteCount ?? '—'}
                          </span>
                        </td>
                        <td style={{ padding: '0 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Megaphone size={12} /> {u.campaignCount ?? '—'}
                          </span>
                        </td>
                        <td style={{ padding: '0 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'system' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 24 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
            System health metrics and feature flags — coming soon.
          </p>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
