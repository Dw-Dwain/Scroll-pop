import React from 'react';
import { SignIn as ClerkSignIn, useSignIn } from '@clerk/clerk-react';

interface SignInProps {
  isDemo?: boolean;
  isDesktop?: boolean;
  onLogin?: () => void;
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const GoogleClerkButton: React.FC = () => {
  const { signIn } = useSignIn();
  const handleGoogle = () => {
    signIn?.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/dashboard',
    });
  };
  return (
    <button
      type="button"
      onClick={handleGoogle}
      className="w-full flex items-center justify-center gap-3 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold py-2.5 rounded-lg transition duration-200 text-sm cursor-pointer"
    >
      <GoogleIcon /> Continue with Google
    </button>
  );
};

export const SignIn: React.FC<SignInProps> = ({ isDemo = false, isDesktop = false, onLogin }) => {
  const [email, setEmail] = React.useState(isDesktop ? 'admin@scrollpop.local' : 'admin@scrollpop.dev');
  const [password, setPassword] = React.useState(isDesktop ? '' : 'devpass123');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDesktop) {
      setLoading(true);
      setError('');
      try {
        const apiBase = (window as any).electronAPI?.getLocalApiUrl?.() ?? 'http://127.0.0.1:3010';
        const res = await fetch(`${apiBase}/api/v1/auth/sign-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const body = await res.json();
          setError(body.error?.message ?? 'Invalid credentials');
          return;
        }
        const { data } = await res.json();
        localStorage.setItem('desktop_token', data.token);
        localStorage.setItem('desktop_user', JSON.stringify(data.user));
        onLogin?.();
      } catch {
        setError('Cannot connect to local server. Please restart the app.');
      } finally {
        setLoading(false);
      }
    } else {
      if (onLogin) onLogin();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 px-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none animate-pulse-slow"></div>

      <div className="w-full max-w-[400px] relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <span className="text-4xl animate-bounce block">🍿</span>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            ScrollPop
          </h1>
          <p className="text-sm text-slate-400">
            {isDemo 
              ? 'Welcome to ScrollPop local playground.' 
              : 'Log in to manage your high-converting popup campaigns.'}
          </p>
        </div>

        {isDesktop && !isDemo ? (
          <div className="bg-slate-900/80 backdrop-blur border border-slate-800 shadow-xl rounded-2xl p-6 text-slate-200 space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-bold text-slate-100">Local Desktop Access</h2>
              <p className="text-xs text-slate-400 mt-1">
                All data stored locally on your machine. No internet required.
              </p>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 text-xs text-rose-400 font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition duration-200 shadow-lg shadow-indigo-500/20 text-sm mt-2 cursor-pointer"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="text-center text-xs text-slate-500 border-t border-slate-800/80 pt-4">
              Default credentials: <code className="text-indigo-400 font-mono">admin@scrollpop.local</code> / <code className="text-indigo-400 font-mono">admin123</code>
            </div>
          </div>
        ) : isDemo ? (
          <div className="bg-slate-900/80 backdrop-blur border border-slate-800 shadow-xl rounded-2xl p-6 text-slate-200 space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-bold text-slate-100">Dev Admin Access</h2>
              <p className="text-xs text-slate-400 mt-1">
                Local dev environment. No Clerk account required.
              </p>
            </div>

            {/* Quick dev login chip */}
            <div className="bg-slate-950 border border-indigo-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Dev Account</div>
                <div className="text-xs font-mono text-slate-300">admin@scrollpop.dev</div>
                <div className="text-xs font-mono text-slate-500">devpass123</div>
              </div>
              <button
                type="button"
                onClick={() => onLogin?.()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition cursor-pointer shrink-0"
              >
                Quick Login
              </button>
            </div>

            <button
              type="button"
              onClick={() => onLogin?.()}
              className="w-full flex items-center justify-center gap-3 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold py-2.5 rounded-lg transition duration-200 text-sm cursor-pointer"
            >
              <GoogleIcon /> Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-xs text-slate-600 font-semibold">or</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  required
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-2.5 rounded-lg transition duration-200 shadow-lg shadow-indigo-500/20 text-sm mt-2 cursor-pointer"
              >
                Enter Dashboard
              </button>
            </form>

            <div className="text-center text-xs text-slate-500 border-t border-slate-800/80 pt-4">
              Switch to production keys in <code className="bg-slate-950 px-1 py-0.5 rounded text-indigo-400 font-mono">apps/dashboard/.env</code> to enable live Clerk auth.
            </div>
          </div>
        ) : (
            <div className="space-y-4">
              {!isDesktop && !isDemo && (
                <>
                  <GoogleClerkButton />
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-800" />
                    <span className="text-xs text-slate-600 font-semibold">or</span>
                    <div className="flex-1 h-px bg-slate-800" />
                  </div>
                </>
              )}
              {(!isDemo) ? (
                <ClerkSignIn
                  routing="virtual"
                  appearance={{
                    elements: {
                      card: 'bg-slate-900/80 backdrop-blur border border-slate-800 shadow-xl rounded-2xl p-6 text-slate-200',
                      headerTitle: 'text-slate-100 font-bold',
                      headerSubtitle: 'text-slate-400',
                      socialButtonsBlockButton: isDesktop ? 'hidden' : '',
                      socialButtonsProviderIcon: isDesktop ? 'hidden' : '',
                      socialButtonsBlockButtonText: isDesktop ? 'hidden' : '',
                      dividerRow: isDesktop ? 'hidden' : '',
                      formButtonPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg transition shadow-md shadow-indigo-500/20',
                      footerActionLink: 'text-indigo-400 hover:text-indigo-300 font-medium transition',
                      formFieldInput: 'bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-lg',
                      formFieldLabel: 'text-slate-400 text-xs font-semibold uppercase tracking-wider',
                    },
                  }}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    );
  };
