import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider, SignedIn, SignedOut, useAuth, useClerk } from '@clerk/clerk-react';
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

const IS_DESKTOP_MODE = typeof window !== 'undefined' && !!(window as any).electronAPI?.isDesktop;

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
const CLERK_PUBLISHABLE_KEY = ((import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY as string)
  || 'pk_test_c2F2ZWQtbWFzdG9kb24tMjcuY2xlcmsuYWNjb3VudHMuZGV2JA';

const IS_DEMO_MODE =
  CLERK_PUBLISHABLE_KEY === 'pk_test_c2F2ZWQtbWFzdG9kb24tMjcuY2xlcmsuYWNjb3VudHMuZGV2JA' ||
  !CLERK_PUBLISHABLE_KEY ||
  ((import.meta as any).env.VITE_DEMO_MODE === 'true');
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
    // Auth routes
    if (currentPath === '/sign-in') return <SignIn isDemo={false} />;
    if (currentPath === '/sign-up') return <SignUp isDemo={false} />;

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
            isDemo={false}
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
            {currentPath === '/profile' ? <Profile isDemo={false} onNavigate={navigate} /> : null}
            {currentPath === '/admin' ? <AdminPanel onNavigate={navigate} /> : null}

            {/* Showcase routes */}
            {currentPath === '/docs'     ? <DocsPage     onNavigate={navigate} /> : null}
            {currentPath === '/status'   ? <StatusPage   onNavigate={navigate} /> : null}
            {currentPath === '/privacy'  ? <PrivacyPage  onNavigate={navigate} /> : null}
            {currentPath === '/terms'    ? <TermsPage    onNavigate={navigate} /> : null}
            {currentPath === '/licenses' ? <LicensePage  onNavigate={navigate} /> : null}
            {currentPath === '/calendar' ? <CalendarPage /> : null}
            {currentPath === '/gallery' ? <ImageGallery /> : null}
            {currentPath === '/chat' ? <SupportChat /> : null}
            {currentPath === '/messages' ? <MessagesPage /> : null}
            {currentPath === '/forms' ? <FormsPage /> : null}
            {currentPath === '/tables' ? <TablesPage /> : null}
          </Layout>
        </Refine>
      </SignedIn>
    );
  };

  return (
    <>
      <SignedOut>
        {currentPath === '/sign-up' ? <SignUp isDemo={false} /> : <SignIn isDemo={false} />}
      </SignedOut>
      {renderRoute()}
    </>
  );
};

const ensureDemoSession = () => {
  try {
    const sid = sessionStorage.getItem('_sp_sid') ?? (() => {
      const id = crypto.randomUUID();
      sessionStorage.setItem('_sp_sid', id);
      return id;
    })();
    const raw = localStorage.getItem('_sp_sessions');
    let sessions = raw ? JSON.parse(raw) : [];
    const existing = sessions.find((s: any) => s.id === sid);
    if (!existing) {
      const ua = navigator.userAgent;
      let label = 'Chrome on Windows';
      let type: 'desktop' | 'mobile' = 'desktop';
      if (/iPhone|iPad|iPod/i.test(ua)) {
        label = `Safari on ${/iPad/i.test(ua) ? 'iPad' : 'iPhone'}`;
        type = 'mobile';
      } else if (/Android/i.test(ua)) {
        label = 'Chrome on Android';
        type = 'mobile';
      } else {
        const browser = /Edg\//i.test(ua) ? 'Edge' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) && !/Chrome/i.test(ua) ? 'Safari' : 'Chrome';
        const os = /Win/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Unknown OS';
        label = `${browser} on ${os}`;
      }
      
      let location = 'Unknown';
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const parts = tz.split('/');
        if (parts.length >= 2) {
          const city = parts[parts.length - 1];
          if (city) location = city.replace(/_/g, ' ');
        } else {
          location = tz;
        }
      } catch {}

      const newSession = {
        id: sid,
        device: label,
        deviceType: type,
        location,
        createdAt: Date.now(),
        current: true,
      };
      sessions = [newSession, ...sessions.map((s: any) => ({ ...s, current: false }))].slice(0, 10);
      localStorage.setItem('_sp_sessions', JSON.stringify(sessions));
    }
  } catch {}
};

const DemoAppContent: React.FC = () => {
  // Custom router state inside React
  const [currentPath, setCurrentPath] = React.useState(window.location.pathname);
  const [isAuthenticated, setIsAuthenticated] = React.useState(true); // Default authenticated for developer speed!

  React.useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  React.useEffect(() => {
    if (isAuthenticated) {
      ensureDemoSession();
      if (currentPath === '/' || currentPath === '/dashboard') {
        try {
          const prefs = JSON.parse(localStorage.getItem('_sp_prefs') ?? '{}');
          const view = prefs.defaultView ?? 'dashboard';
          if (view !== 'dashboard') {
            navigate(`/${view}`);
          }
        } catch {}
      }
    }
  }, [isAuthenticated]);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const handleLogout = async () => {
    setIsAuthenticated(false);
    navigate('/sign-in');
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    try {
      const prefs = JSON.parse(localStorage.getItem('_sp_prefs') ?? '{}');
      const view = prefs.defaultView ?? 'dashboard';
      navigate(`/${view}`);
    } catch {
      navigate('/dashboard');
    }
  };

  // Refine Providers
  const dummyGetToken = React.useCallback(async () => 'demo_token', []);
  const dataProvider = React.useMemo(() => createDataProvider(dummyGetToken), [dummyGetToken]);
  
  // Render routing mapper
  const renderRoute = () => {
    // Auth routes
    if (currentPath === '/sign-in') return <SignIn isDemo={true} onLogin={handleLogin} />;
    if (currentPath === '/sign-up') return <SignUp isDemo={true} onSignUp={handleLogin} />;

    if (!isAuthenticated) {
      return <SignIn isDemo={true} onLogin={handleLogin} />;
    }

    // Protected Admin routes
    return (
      <Refine
        dataProvider={dataProvider}
        options={{ syncWithLocation: true, warnWhenUnsavedChanges: true, disableTelemetry: true }}
      >
        <Layout
          currentPath={currentPath}
          onNavigate={navigate}
          onLogout={handleLogout}
          isDemo={true}
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
          {currentPath === '/profile' ? <Profile isDemo={true} onNavigate={navigate} /> : null}
          {currentPath === '/admin' ? <AdminPanel onNavigate={navigate} /> : null}

          {currentPath === '/docs'     ? <DocsPage     onNavigate={navigate} /> : null}
          {currentPath === '/status'   ? <StatusPage   onNavigate={navigate} /> : null}
          {currentPath === '/privacy'  ? <PrivacyPage  onNavigate={navigate} /> : null}
          {currentPath === '/terms'    ? <TermsPage    onNavigate={navigate} /> : null}
          {currentPath === '/licenses' ? <LicensePage  onNavigate={navigate} /> : null}

          {/* Showcase routes */}
          {currentPath === '/calendar' ? <CalendarPage /> : null}
          {currentPath === '/gallery' ? <ImageGallery /> : null}
          {currentPath === '/chat' ? <SupportChat /> : null}
          {currentPath === '/messages' ? <MessagesPage /> : null}
          {currentPath === '/forms' ? <FormsPage /> : null}
          {currentPath === '/tables' ? <TablesPage /> : null}
        </Layout>
      </Refine>
    );
  };

  return (
    <>
      {renderRoute()}
    </>
  );
};

const DesktopAppContent: React.FC = () => {
  const getInitialDesktopPath = () => {
    const hash = window.location.hash.replace('#', '');
    return hash || '/dashboard';
  };
  const [currentPath, setCurrentPath] = React.useState(getInitialDesktopPath);
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => !!localStorage.getItem('desktop_token'));

  React.useEffect(() => {
    const handleHashChange = () => setCurrentPath(getInitialDesktopPath());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path: string) => {
    window.location.hash = path;
    setCurrentPath(path);
  };

  const handleLogout = () => {
    localStorage.removeItem('desktop_token');
    setIsAuthenticated(false);
    navigate('/sign-in');
  };
  
  const handleLogin = () => {
    // Save the internal secret to auth bypass the cloud
    const secret = (import.meta as any).env.VITE_INTERNAL_SECRET || 'change_me_in_production_32_chars_min';
    localStorage.setItem('desktop_token', secret);
    setIsAuthenticated(true);
    try {
      const prefs = JSON.parse(localStorage.getItem('_sp_prefs') ?? '{}');
      const view = prefs.defaultView ?? 'dashboard';
      navigate(`/${view}`);
    } catch {
      navigate('/dashboard');
    }
  };

  const desktopGetToken = React.useCallback(async () => localStorage.getItem('desktop_token'), []);
  const dataProvider = React.useMemo(() => createDataProvider(desktopGetToken), [desktopGetToken]);

  const renderRoute = () => {
    if (currentPath === '/sign-in') return <SignIn isDemo={true} isDesktop={true} onLogin={handleLogin} />;
    if (currentPath === '/sign-up') return <SignIn isDemo={true} isDesktop={true} onLogin={handleLogin} />;

    if (!isAuthenticated) return <SignIn isDemo={true} isDesktop={true} onLogin={handleLogin} />;

    return (
      <Refine dataProvider={dataProvider} options={{ syncWithLocation: false, warnWhenUnsavedChanges: false, disableTelemetry: true }}>
        <Layout currentPath={currentPath} onNavigate={navigate} onLogout={handleLogout} isDemo={true}>
          {currentPath === '/dashboard' || currentPath === '/' ? (OPS_CENTER_ENABLED ? <OpsCenter onNavigate={navigate} /> : <Dashboard onNavigate={navigate} />) : null}
          {currentPath === '/journeys' && JOURNEYS_ENABLED ? <Journeys onNavigate={navigate} /> : null}
          {currentPath === '/experiments' && EXPERIMENTS_ENABLED ? <Experiments onNavigate={navigate} /> : null}
          {currentPath === '/sites' ? <Sites /> : null}
          {currentPath === '/campaigns' ? <Campaigns onNavigate={navigate} /> : null}
          {currentPath === '/campaigns/new' ? <CampaignWizard onNavigate={navigate} /> : null}
          {getCampaignDetailId(currentPath) ? <CampaignDetail campaignId={getCampaignDetailId(currentPath)!} onNavigate={navigate} /> : null}
          {getCampaignDesignId(currentPath) ? <CampaignDesign campaignId={getCampaignDesignId(currentPath)!} onNavigate={navigate} /> : null}
          {currentPath === '/analytics' ? <Analytics onNavigate={navigate} /> : null}
          {currentPath === '/billing' ? <Billing /> : null}
          {currentPath === '/settings' ? <Settings /> : null}
          {currentPath === '/profile' ? <Profile isDemo={false} isDesktop={true} onNavigate={navigate} /> : null}
          {currentPath === '/docs'     ? <DocsPage     onNavigate={navigate} /> : null}
          {currentPath === '/status'   ? <StatusPage   onNavigate={navigate} /> : null}
          {currentPath === '/privacy'  ? <PrivacyPage  onNavigate={navigate} /> : null}
          {currentPath === '/terms'    ? <TermsPage    onNavigate={navigate} /> : null}
          {currentPath === '/licenses' ? <LicensePage  onNavigate={navigate} /> : null}
          {currentPath === '/calendar' ? <CalendarPage /> : null}
          {currentPath === '/gallery' ? <ImageGallery /> : null}
          {currentPath === '/chat' ? <SupportChat /> : null}
          {currentPath === '/messages' ? <MessagesPage /> : null}
          {currentPath === '/forms' ? <FormsPage /> : null}
          {currentPath === '/tables' ? <TablesPage /> : null}
        </Layout>
      </Refine>
    );
  };

  return <>{renderRoute()}</>;
};

const Root: React.FC = () => {
  if (IS_DESKTOP_MODE) {
    return <DesktopAppContent />;
  }
  if (IS_DEMO_MODE) {
    return <DemoAppContent />;
  }
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} signInUrl="/sign-in" signUpUrl="/sign-up" signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard">
      <ClerkAppContent />
    </ClerkProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
