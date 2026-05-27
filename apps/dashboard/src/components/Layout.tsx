import React from 'react';
import {
  LayoutDashboard,
  Globe,
  Megaphone,
  BarChart2,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  Crown,
  Radar,
  FlaskConical,
  Radio,
  ChevronDown,
  User,
} from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import { usePlan, PLAN_LIMITS, PLAN_ORDER } from '../hooks/usePlan';
import type { PlanId } from '../hooks/usePlan';
import { isFeatureEnabled } from '../lib/flags';

interface LayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  isDemo?: boolean;
}

function loadProfileFromStorage() {
  try {
    const raw = localStorage.getItem('desktop_user') || localStorage.getItem('_sp_profile');
    if (raw) return JSON.parse(raw) as { name?: string; email?: string; avatar?: string; avatarUrl?: string };
  } catch {}
  return null;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

const PLAN_VIEWS: Record<PlanId, number> = {
  free:    1_000,
  starter: 25_000,
  growth:  150_000,
  scale:   500_000,
  agency:  2_000_000,
};

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentPath,
  onNavigate,
  onLogout,
  isDemo = false,
}) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [orgOpen, setOrgOpen] = React.useState(false);
  const orgRef = React.useRef<HTMLDivElement>(null);
  const [userProfile, setUserProfile] = React.useState(loadProfileFromStorage);
  const { plan, isAdmin } = usePlan();

  const journeysEnabled = isFeatureEnabled('ff_journeys_ui');
  const opsEnabled = isFeatureEnabled('ff_realtime_ops_dashboard');
  const experimentsEnabled = isFeatureEnabled('ff_experiments_v1');

  React.useEffect(() => {
    const onStorage = () => setUserProfile(loadProfileFromStorage());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) setOrgOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const viewsUsed = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('_sp_views_used');
      return raw ? parseInt(raw, 10) : 0;
    } catch { return 0; }
  }, []);

  const maxViews = isAdmin ? Infinity : PLAN_VIEWS[plan] ?? 1000;
  const usagePct = maxViews === Infinity ? 0 : Math.min(100, Math.round((viewsUsed / maxViews) * 100));
  const usageColor = usagePct >= 95 ? 'var(--status-error)' : usagePct >= 80 ? 'var(--status-warning)' : 'var(--accent-500)';

  const primaryNav = [
    { label: 'Dashboard',   path: '/dashboard', icon: LayoutDashboard },
    { label: 'Campaigns',   path: '/campaigns', icon: Megaphone },
    { label: 'Analytics',   path: '/analytics', icon: BarChart2 },
    { label: 'Sites',       path: '/sites',     icon: Globe },
    ...(journeysEnabled    ? [{ label: 'Journeys',    path: '/journeys',     icon: Radar,         beta: true }] : []),
    ...(experimentsEnabled ? [{ label: 'Experiments', path: '/experiments',  icon: FlaskConical,  beta: true }] : []),
    ...(opsEnabled         ? [{ label: 'Ops Center',  path: '/ops',          icon: Radio }] : []),
  ];

  const bottomNav = [
    { label: 'Billing',  path: '/billing',  icon: CreditCard },
    { label: 'Settings', path: '/settings', icon: Settings },
    ...(isAdmin ? [{ label: 'Admin', path: '/admin', icon: Crown }] : []),
  ];

  const isActive = (path: string) =>
    currentPath === path || (path !== '/dashboard' && currentPath.startsWith(path));

  const NavItem = ({ item }: { item: { label: string; path: string; icon: React.FC<any>; beta?: boolean } }) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <button
        onClick={() => { onNavigate(item.path); setMobileOpen(false); }}
        className={`nav-item${active ? ' active' : ''}`}
      >
        <Icon size={16} />
        <span style={{ flex: 1 }}>{item.label}</span>
        {item.beta && (
          <span style={{ fontSize: 10, color: 'var(--accent-500)', fontWeight: 500 }}>beta</span>
        )}
      </button>
    );
  };

  const SidebarContent = () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'linear-gradient(180deg, #111113 0%, #0f0f10 100%)',
    }}>
      {/* Wordmark + Org Switcher */}
      <div style={{ padding: '16px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div
          ref={orgRef}
          style={{ position: 'relative' }}
        >
          <button
            onClick={() => setOrgOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 8px',
              borderRadius: 6,
              color: 'var(--text-primary)',
            }}
            className="nav-item"
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 15, flex: 1, letterSpacing: '-0.01em' }}>
              scrollpop
            </span>
            <ChevronDown
              size={14}
              style={{
                color: 'var(--text-muted)',
                transition: 'transform 200ms',
                transform: orgOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          {orgOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
              padding: '4px',
              zIndex: 100,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
              <div style={{ padding: '8px 12px 4px', fontSize: 11, color: 'var(--text-muted)' }}>
                {userProfile?.email ?? 'admin@scrollpop.dev'}
              </div>
              <button
                onClick={() => { onNavigate('/profile'); setOrgOpen(false); }}
                className="nav-item"
                style={{ width: '100%', textAlign: 'left', padding: '6px 12px', borderRadius: 4 }}
              >
                <User size={14} />
                <span>Profile</span>
              </button>
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
              <button
                onClick={() => { onLogout(); setOrgOpen(false); }}
                className="nav-item"
                style={{ width: '100%', textAlign: 'left', padding: '6px 12px', borderRadius: 4, color: 'var(--status-error)' }}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Primary nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {primaryNav.map((item) => (
          <NavItem key={item.path} item={item} />
        ))}

        {/* Bottom nav group (billing, settings, admin) */}
        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '12px 4px' }} />
        {bottomNav.map((item) => (
          <NavItem key={item.path} item={item} />
        ))}
      </nav>

      {/* User + Usage bar */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '12px 12px 16px',
      }}>
        {/* Avatar row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}>
          {isDemo ? (
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--accent-600)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, color: '#fff', flexShrink: 0,
            }}>
              {userProfile?.name ? getInitials(userProfile.name) : 'DA'}
            </div>
          ) : (
            <UserButton afterSignOutUrl="/sign-in" />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userProfile?.name ?? 'Admin'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userProfile?.email ?? 'admin@scrollpop.dev'}
            </div>
          </div>
        </div>

        {/* Usage bar */}
        {!isAdmin && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Plan: <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{plan}</span>
              </span>
              <span style={{ fontSize: 11, color: usagePct >= 80 ? usageColor : 'var(--text-muted)' }}>
                {usagePct}%
              </span>
            </div>
            <div className="usage-bar-track">
              <div
                className="usage-bar-fill"
                style={{ width: `${usagePct}%`, background: usageColor }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              {viewsUsed.toLocaleString()} / {maxViews === Infinity ? '∞' : maxViews.toLocaleString()} views
            </div>
          </div>
        )}
        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Crown size={12} style={{ color: 'var(--accent-300)' }} />
            <span style={{ fontSize: 11, color: 'var(--accent-300)' }}>Admin — unlimited</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-root)' }}>
      {/* Desktop sidebar */}
      <aside
        style={{
          width: 'var(--sidebar-width)',
          flexShrink: 0,
          borderRight: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        className="hidden md:flex"
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--bg-root)',
          minHeight: '100vh',
        }}
      >
        {/* Mobile top bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-base)',
          }}
          className="md:hidden"
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 500 }}>
            scrollpop
          </span>
          <button className="btn btn-icon" onClick={() => setMobileOpen(true)}>
            <Menu size={18} />
          </button>
        </div>

        <div
          className="page-enter"
          style={{ padding: '24px', maxWidth: 1280, minHeight: 'calc(100vh - 56px)' }}
        >
          {children}
        </div>
      </main>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 40,
            }}
          />
          <aside
            style={{
              position: 'fixed', inset: '0 auto 0 0',
              width: 260,
              zIndex: 50,
              borderRight: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 51 }}>
              <button className="btn btn-icon" onClick={() => setMobileOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: 56,
          background: 'var(--bg-base)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 30,
          padding: '0 8px',
        }}
      >
        {[
          { label: 'Home',      path: '/dashboard', icon: LayoutDashboard },
          { label: 'Analytics', path: '/analytics', icon: BarChart2 },
          { label: 'Sites',     path: '/sites',     icon: Globe },
          { label: 'Settings',  path: '/settings',  icon: Settings },
        ].map(({ label, path, icon: Icon }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => onNavigate(path)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '6px 12px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: active ? 'var(--accent-300)' : 'var(--text-muted)',
                fontSize: 10,
              }}
            >
              <Icon size={18} />
              {active && <span>{label}</span>}
            </button>
          );
        })}
        {/* Center new campaign button */}
        <button
          onClick={() => onNavigate('/campaigns/new')}
          style={{
            width: 48, height: 48,
            borderRadius: '50%',
            background: 'var(--accent-500)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
          }}
        >
          <Megaphone size={20} />
        </button>
      </nav>
    </div>
  );
};
