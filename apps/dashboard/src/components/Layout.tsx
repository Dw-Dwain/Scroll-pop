import React from 'react';
import {
  LayoutDashboard,
  Globe,
  Megaphone,
  BarChart2,
  Mail,
  CreditCard,
  Settings,
  LogOut,
  Crown,
  Radar,
  FlaskConical,
  Radio,
  ChevronDown,
  User,
  Menu,
  X,
  Plus,
  Sun,
  Moon,
  Users,
} from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import { usePlan } from '../hooks/usePlan';
import type { PlanId } from '../hooks/usePlan'; // used in PLAN_VIEWS lookup
import { isFeatureEnabled } from '../lib/flags';
import { NotificationBell } from './NotificationBell';
import { ClientSwitcher } from './ClientSwitcher';
import { PendingInvites } from './PendingInvites';

interface LayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

function loadProfileFromStorage() {
  try {
    const raw = localStorage.getItem('_sp_profile');
    if (raw) return JSON.parse(raw) as { name?: string; email?: string; avatar?: string; avatarUrl?: string };
  } catch {}
  return null;
}

function _getInitials(name: string) {
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
}) => {
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const [userProfile, setUserProfile] = React.useState(loadProfileFromStorage);
  const { plan, isAdmin, isUnlimited } = usePlan();
  const isAgency = plan === 'agency' || isUnlimited;

  // ── Global theme ────────────────────────────────────────────
  const [isDarkTheme, setIsDarkTheme] = React.useState(() => {
    try { return localStorage.getItem('sp_theme') === 'dark'; } catch { return false; }
  });
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
    try { localStorage.setItem('sp_theme', isDarkTheme ? 'dark' : 'light'); } catch {}
  }, [isDarkTheme]);

  // Set __sp_admin flag so the snippet skips tracking when the site owner is
  // browsing their own site while logged into the dashboard.
  React.useEffect(() => {
    try { localStorage.setItem('__sp_admin', '1'); } catch {}
    return () => { try { localStorage.removeItem('__sp_admin'); } catch {} };
  }, []);

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
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
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

  type NavItem = { label: string; path: string; icon: React.FC<{ size?: number }>; beta?: boolean };
  const primaryNav: NavItem[] = [
    { label: 'Dashboard',   path: '/dashboard', icon: LayoutDashboard },
    { label: 'Sites',       path: '/sites',     icon: Globe },
    { label: 'Campaigns',   path: '/campaigns', icon: Megaphone },
    { label: 'Leads',       path: '/leads',     icon: Mail },
    { label: 'Analytics',   path: '/analytics', icon: BarChart2 },
    ...(isAgency           ? [{ label: 'Team',        path: '/team',        icon: Users }] : []),
    ...(journeysEnabled    ? [{ label: 'Journeys',    path: '/journeys',    icon: Radar,        beta: true }] : []),
    ...(experimentsEnabled ? [{ label: 'Experiments', path: '/experiments', icon: FlaskConical, beta: true }] : []),
    ...(opsEnabled         ? [{ label: 'Ops',         path: '/ops',         icon: Radio }] : []),
  ];

  const isActive = (path: string) =>
    currentPath === path || (path !== '/dashboard' && currentPath.startsWith(path));

  // Full-screen editor paths: campaign wizard + campaign design editor
  const isFullScreenEditor = currentPath === '/campaigns/new' || /\/campaigns\/.+\/design/.test(currentPath);
  const isSplitPage = currentPath === '/profile' || currentPath === '/settings';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-root)' }}>

      {/* ── Top Navigation Bar ─────────────────────────────────── */}
      <header style={{
        height: 'var(--topnav-height, 48px)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'var(--topnav-bg, #0a0a0a)',
        zIndex: 100,
        padding: '0 16px',
      }}>

        {/* Logo mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 28, flexShrink: 0 }}>
          {/* Circle icon */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="13.5" fill="white" stroke="white" strokeWidth="0.5"/>
            <rect x="9.5" y="9.5" width="9" height="9" rx="1" fill="#0a0a0a" transform="rotate(45 14 14)"/>
          </svg>
          {/* Wordmark */}
          <div style={{ lineHeight: 1 }}>
            <div style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.14em',
              color: '#ffffff',
              textTransform: 'uppercase',
            }}>
              SCROLLPOP
              {isAdmin && <Crown size={9} style={{ color: '#f59e0b', marginLeft: 5, display: 'inline', verticalAlign: 'middle' }} />}
            </div>
            <div style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 400,
              fontSize: 7.5,
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
              marginTop: 2,
            }}>
              CONVERSION STUDIO
            </div>
          </div>
        </div>

        {/* Agency client-workspace switcher (hidden for non-agency tenants) */}
        <div className="hidden md:block"><ClientSwitcher /></div>

        {/* Primary nav — desktop */}
        <nav
          className="hidden md:flex"
          style={{ alignItems: 'center', gap: 2, flex: 1 }}
        >
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => onNavigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: 6,
                  background: active ? 'rgba(255,255,255,0.12)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  letterSpacing: active ? '0.01em' : '0.02em',
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.6)',
                  transition: 'background 0.12s, color 0.12s',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLButtonElement).style.color = '#ffffff'; } }}
                onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'; } }}
              >
                <Icon size={14} />
                {item.label}
                {item.beta && (
                  <span style={{ fontSize: 9, color: 'var(--accent-500)', fontWeight: 500, letterSpacing: '0.03em' }}>β</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0, paddingRight: 16 }}>

          {/* New Campaign shortcut */}
          <button
            onClick={() => onNavigate('/campaigns/new')}
            className="hidden md:flex"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 6,
              background: '#ffffff', color: '#0a0a0a',
              border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.03em',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#e4e4e7')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#ffffff')}
          >
            <Plus size={12} />
            New Campaign
          </button>

          {/* Usage pill — desktop only, non-admin */}
          {!isAdmin && (
            <div
              className="hidden md:flex"
              style={{ alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}
              onClick={() => onNavigate('/billing')}
              title={`${viewsUsed.toLocaleString()} / ${maxViews === Infinity ? '∞' : maxViews.toLocaleString()} views`}
            >
              <div style={{ width: 48, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${usagePct}%`, background: usageColor, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{plan}</span>
            </div>
          )}

          {/* Notifications */}
          <NotificationBell onNavigate={onNavigate} />

          {/* Theme toggle */}
          <button
            onClick={() => setIsDarkTheme(d => !d)}
            className="btn btn-icon hidden md:flex"
            title={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            {isDarkTheme ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Settings + Billing shortcuts */}
          <button
            onClick={() => onNavigate('/settings')}
            className="btn btn-icon hidden md:flex"
            title="Settings"
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            <Settings size={15} />
          </button>

          {isAdmin && (
            <button
              onClick={() => onNavigate('/admin')}
              className="btn btn-icon hidden md:flex"
              title="Admin"
              style={{ color: '#f59e0b' }}
            >
              <Crown size={15} />
            </button>
          )}

          {/* User / avatar dropdown */}
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '3px 6px',
                borderRadius: 6,
                color: 'rgba(255,255,255,0.65)',
              }}
            >
              <UserButton afterSignOutUrl="/sign-in" />
              <ChevronDown size={12} style={{ color: 'rgba(255,255,255,0.4)', transition: 'transform 150ms', transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </button>

            {userMenuOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                minWidth: 200,
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                padding: 4,
                zIndex: 200,
                boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{userProfile?.name ?? 'Account'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{userProfile?.email ?? ''}</div>
                  {!isAdmin && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{plan} plan</span>
                        <span style={{ fontSize: 10, color: usagePct >= 80 ? usageColor : 'var(--text-muted)' }}>{usagePct}%</span>
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-overlay)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${usagePct}%`, background: usageColor, borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {viewsUsed.toLocaleString()} / {maxViews === Infinity ? '∞' : maxViews.toLocaleString()} views
                      </div>
                    </div>
                  )}
                  {isAdmin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Crown size={10} style={{ color: 'var(--accent-300)' }} />
                      <span style={{ fontSize: 10, color: 'var(--accent-300)' }}>Admin — unlimited</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => { onNavigate('/profile'); setUserMenuOpen(false); }}
                  className="nav-item"
                  style={{ width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 4, fontSize: 13 }}
                >
                  <User size={13} />
                  <span>Profile</span>
                </button>
                <button
                  onClick={() => { onNavigate('/billing'); setUserMenuOpen(false); }}
                  className="nav-item"
                  style={{ width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 4, fontSize: 13 }}
                >
                  <CreditCard size={13} />
                  <span>Billing</span>
                </button>
                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                <button
                  onClick={() => { onLogout(); setUserMenuOpen(false); }}
                  className="nav-item"
                  style={{ width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 4, fontSize: 13, color: 'var(--status-error)' }}
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button className="btn btn-icon flex md:hidden" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={16} />
          </button>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────── */}
      <main
        id="sp-main"
        style={{
          flex: 1,
          overflowY: (isFullScreenEditor || isSplitPage) ? 'hidden' : 'auto',
          background: 'var(--bg-root)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Page content — flex: 1 pushes footer to bottom */}
        <div
          className={isFullScreenEditor ? '' : 'page-enter'}
          style={{
            flex: 1,
            padding: (isFullScreenEditor || isSplitPage) ? '0' : '32px 40px 24px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            height: isSplitPage ? '100%' : 'auto',
            overflow: isSplitPage ? 'hidden' : 'visible',
          }}
        >
          {!isFullScreenEditor && !isSplitPage && <PendingInvites />}
          {children}
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────── */}
      {!isFullScreenEditor && (
        <footer style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: '#0a0a0a',
          padding: '12px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexShrink: 0,
        }}>
          {/* Left: brand + version */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 11, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>
              SCROLLPOP
            </span>
            <span style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.15)' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>
              v0.1.0-beta
            </span>
          </div>

          {/* Center: links — internal app pages */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {[
              { label: 'Docs',     path: '/docs'     },
              { label: 'Status',   path: '/status'   },
              { label: 'Privacy',  path: '/privacy'  },
              { label: 'Terms',    path: '/terms'    },
              { label: 'Licenses', path: '/licenses' },
            ].map(({ label, path }) => (
              <button
                key={label}
                onClick={() => onNavigate(path)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.4)',
                  fontFamily: 'var(--font-sans)',
                  letterSpacing: '0.03em',
                  padding: 0,
                  transition: 'color 0.12s',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)')}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Right: copyright */}
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em' }}>
            © {new Date().getFullYear()} SCROLLPOP
          </span>
        </footer>
      )}

      {/* ── Mobile nav drawer ─────────────────────────────────── */}
      {mobileMenuOpen && (
        <>
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 300,
            }}
          />
          <div style={{
            position: 'fixed', inset: '0 auto 0 0',
            width: 260,
            zIndex: 310,
            background: 'var(--bg-base)',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            padding: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500 }}>scrollpop</span>
              <button className="btn btn-icon" onClick={() => setMobileMenuOpen(false)}><X size={16} /></button>
            </div>
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => { onNavigate(item.path); setMobileMenuOpen(false); }}
                  className={`nav-item${active ? ' active' : ''}`}
                >
                  <Icon size={15} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.beta && <span style={{ fontSize: 9, color: 'var(--accent-500)' }}>β</span>}
                </button>
              );
            })}
            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '8px 0' }} />
            {[
              { label: 'Billing', path: '/billing', icon: CreditCard },
              { label: 'Settings', path: '/settings', icon: Settings },
              ...(isAdmin ? [{ label: 'Admin', path: '/admin', icon: Crown }] : []),
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => { onNavigate(item.path); setMobileMenuOpen(false); }}
                  className={`nav-item${isActive(item.path) ? ' active' : ''}`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '8px 0' }} />
            <button
              onClick={() => { onLogout(); setMobileMenuOpen(false); }}
              className="nav-item"
              style={{ color: 'var(--status-error)' }}
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
