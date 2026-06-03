import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider, SignedIn, SignedOut, useAuth, useClerk, useUser, AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import { initObservability } from './lib/observability';

// ── Mobile gate ───────────────────────────────────────────────────────────────
// The dashboard is a desktop-only tool. Mobile visitors see a friendly
// "open on desktop" screen. Sign-in and sign-up are still accessible so
// users can create an account on their phone and log in later on desktop.
const MOBILE_BREAKPOINT = 768; // px — same as Tailwind md:

function useIsMobile(): boolean {
  const [mobile, setMobile] = React.useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT,
  );
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

const MOBILE_ALLOWED_PATHS = ['/sign-in', '/sign-up', '/sso-callback'];

const MobileGate: React.FC<{ currentPath: string; children: React.ReactNode }> = ({
  currentPath,
  children,
}) => {
  const isMobile = useIsMobile();
  const isAllowed = MOBILE_ALLOWED_PATHS.some((p) => currentPath.startsWith(p));

  if (!isMobile || isAllowed) return <>{children}</>;

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0a0a0b',
      color: '#f5f5f4',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Logo mark */}
      <div style={{
        width: 56, height: 56, borderRadius: '50%', background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <polygon points="12,2 20,20 12,16 4,20" fill="#0a0a0b" />
        </svg>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.3px' }}>
        Desktop only
      </h1>
      <p style={{ fontSize: 14, color: '#a3a3a3', lineHeight: 1.6, maxWidth: 280, margin: '0 0 32px' }}>
        The ScrollPop dashboard is designed for desktop browsers.
        Open <strong style={{ color: '#fff' }}>dashboard.scrollpop.online</strong> on
        your computer to manage campaigns and analytics.
      </p>
      <a
        href="/sign-in"
        style={{
          display: 'inline-block',
          padding: '10px 24px',
          background: '#6366f1',
          color: '#fff',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          marginBottom: 12,
        }}
      >
        Sign in anyway
      </a>
      <a
        href="https://scrollpop.online"
        style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none' }}
      >
        ← Back to scrollpop.online
      </a>
    </div>
  );
};
import { Refine } from '@refinedev/core';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { OpsCenter } from './pages/OpsCenter';
import { Sites } from './pages/Sites';
import { Campaigns } from './pages/Campaigns';
import { Journeys } from './pages/Journeys';
import { Experiments } from './pages/Experiments';
import { CampaignWizard } from './pages/CampaignWizard';
import { CampaignDetail } from './pages/CampaignDetail';
import { CampaignDesign } from './pages/CampaignDesign';
import { Analytics } from './pages/Analytics';
import { Profile } from './pages/Profile';
import { Billing } from './pages/Billing';
import { Settings } from './pages/Settings';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import { AdminPanel } from './pages/AdminPanel';
import { DocsPage } from './pages/DocsPage';
import { StatusPage } from './pages/StatusPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { LicensePage } from './pages/LicensePage';



const getCampaignDetailId = (path: string) => {
  if (path.startsWith('/campaigns/detail/')) {
    return path.replace('/campaigns/detail/', '');
  }
  return null;
};

const getCampaignDesignId = (path: string) => {
  const m = path.match(/^\/campaigns\/([^/]+)\/design$/);
  return m ? m[1] : null;
};

// Glazzed showcase pages
import { SupportChat } from './pages/SupportChat';
import { ImageGallery } from './pages/ImageGallery';
import { CalendarPage } from './pages/CalendarPage';
import { MessagesPage } from './pages/MessagesPage';
import { FormsPage } from './pages/FormsPage';
import { TablesPage } from './pages/TablesPage';

import { createDataProvider } from './providers/dataProvider';
import { isFeatureEnabled } from './lib/flags';
import './index.css';

// Clerk Publishable Key mapping
const PUBLISHABLE_KEY =
  (import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY ||
  (window as any).__ENV__?.VITE_CLERK_PUBLISHABLE_KEY;

const OPS_CENTER_ENABLED = isFeatureEnabled('ff_realtime_ops_dashboard');
const JOURNEYS_ENABLED = isFeatureEnabled('ff_journeys_ui');
const EXPERIMENTS_ENABLED = isFeatureEnabled('ff_experiments_v1');

const ClerkAppContent: React.FC = () => {
  const { getToken, signOut } = useAuth();
  
  // Custom router state inside React
  const [currentPath, setCurrentPath] = React.useState(window.location.pathname);

  React.useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/sign-in');
  };

  // Refine Providers
  const dataProvider = React.useMemo(() => createDataProvider(getToken), [getToken]);
  
  // Render routing mapper
  const renderRoute = () => {
    // Clerk SSO callback — must be handled before anything else
    if (currentPath.startsWith('/sso-callback')) return <AuthenticateWithRedirectCallback />;

    // Auth routes (/sign-in, /sign-up) are rendered by the <SignedOut> block below —
    // do NOT also return them here, or two Clerk auth forms mount and the sign-up flow
    // initializes twice (doubling requests against Clerk's per-IP rate limit, which bites
    // fastest on cellular/carrier-NAT shared IPs → "too many requests" on mobile).

    // Protected Admin routes
    return (
      <SignedIn>
        <Refine
          dataProvider={dataProvider}
          options={{ syncWithLocation: true, warnWhenUnsavedChanges: true, disableTelemetry: true }}
        >
          <Layout
            currentPath={currentPath}
            onNavigate={navigate}
            onLogout={handleLogout}
          >
            {currentPath === '/dashboard' || currentPath === '/' ? (OPS_CENTER_ENABLED ? <OpsCenter onNavigate={navigate} /> : <Dashboard onNavigate={navigate} />) : null}
            {currentPath === '/journeys' && JOURNEYS_ENABLED ? <Journeys onNavigate={navigate} /> : null}
            {currentPath === '/experiments' && EXPERIMENTS_ENABLED ? <Experiments onNavigate={navigate} /> : null}
            {currentPath === '/sites' ? <Sites onNavigate={navigate} /> : null}
            {currentPath === '/campaigns' ? <Campaigns onNavigate={navigate} /> : null}
            {currentPath === '/campaigns/new' ? <CampaignWizard onNavigate={navigate} /> : null}
            {getCampaignDetailId(currentPath) ? <CampaignDetail campaignId={getCampaignDetailId(currentPath)!} onNavigate={navigate} /> : null}
            {getCampaignDesignId(currentPath) ? <CampaignDesign campaignId={getCampaignDesignId(currentPath)!} onNavigate={navigate} /> : null}
            {currentPath === '/analytics' ? <Analytics onNavigate={navigate} /> : null}
            {currentPath === '/billing' ? <Billing onNavigate={navigate} /> : null}
            {currentPath === '/settings' ? <Settings /> : null}
            {currentPath === '/profile' ? <Profile onNavigate={navigate} /> : null}
            {currentPath === '/admin' ? <AdminPanel onNavigate={navigate} /> : null}

            {currentPath === '/docs'     ? <DocsPage     onNavigate={navigate} /> : null}
            {currentPath === '/status'   ? <StatusPage   onNavigate={navigate} /> : null}
            {currentPath === '/privacy'  ? <PrivacyPage  onNavigate={navigate} /> : null}
            {currentPath === '/terms'    ? <TermsPage    onNavigate={navigate} /> : null}
            {currentPath === '/licenses' ? <LicensePage  onNavigate={navigate} /> : null}
            {/* UI-kit showcase pages (calendar/gallery/chat/messages/forms/tables) render
                hardcoded sample data with no real backing, so they are intentionally NOT routed. */}
          </Layout>
        </Refine>
      </SignedIn>
    );
  };

  return (
    <MobileGate currentPath={currentPath}>
      <SignedOut>
        {currentPath === '/sign-up' ? <SignUp /> : <SignIn />}
      </SignedOut>
      {renderRoute()}
    </MobileGate>
  );
};

const Root: React.FC = () => {
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY || ''}
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      allowedRedirectOrigins={[
        'https://dashboard.scrollpop.online',
        'https://scrollpop-dashboard.pages.dev',
        'https://dev.scrollpop-dashboard.pages.dev',
        /^https:\/\/[a-z0-9]+\.scrollpop-dashboard\.pages\.dev$/,
      ]}
    >
      <ClerkAppContent />
    </ClerkProvider>
  );
};

initObservability();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
