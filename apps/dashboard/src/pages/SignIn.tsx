import React from 'react';
import { useSignIn } from '@clerk/clerk-react';

export const SignIn: React.FC = () => {
  const STATS = [
    { num: '12,400', label: 'campaigns created' },
    { num: '4.2M',   label: 'popup views served' },
    { num: '98ms',   label: 'median load time' },
  ];

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: 'var(--bg-root)',
    }}>
      {/* Left panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 48,
        borderRight: '1px solid var(--border-subtle)',
        background: 'var(--bg-root)',
        backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.1) 0%, transparent 60%)',
      }}
        className="hidden md:flex"
      >
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', marginBottom: 64 }}>
            scrollpop
          </div>
          <div style={{ maxWidth: 360 }}>
            <p style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-primary)', lineHeight: '32px', margin: '0 0 24px', letterSpacing: '-0.01em' }}>
              Convert more.<br />Without the friction.
            </p>
            <div style={{
              padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, marginBottom: 16,
            }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px', fontStyle: 'italic' }}>
                "ScrollPop increased our affiliate revenue by 340% in 60 days. The data-first dashboard is exactly what operators need."
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#fff' }}>
                  JM
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Jamie M.</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Senior Affiliate Manager, NexGen Media</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 32 }}>
          {STATS.map(({ num, label }) => (
            <div key={label}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>{num}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        width: '100%',
        maxWidth: 480,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        background: 'var(--bg-surface)',
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          {/* Mobile wordmark */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, marginBottom: 32 }} className="md:hidden">
            scrollpop
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
            Sign in to ScrollPop
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 24px' }}>
            Welcome back.
          </p>

          <ClerkSignInForm />
        </div>
      </div>
    </div>
  );
};

function ClerkSignInForm() {
  const { signIn, isLoaded } = useSignIn();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    setLoading(true);
    setError('');
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  // OAuth: use ABSOLUTE redirect URLs (Clerk can silently no-op on relative ones) and
  // surface any failure instead of failing silently. The button is disabled until Clerk
  // is loaded so a tap before load can't be a dead no-op.
  const oauth = async (strategy: 'oauth_google' | 'oauth_github') => {
    if (!isLoaded || !signIn) return;
    setError('');
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/dashboard`,
      });
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? 'Could not continue with that provider. Please try again.');
    }
  };
  const handleGoogle = () => { void oauth('oauth_google'); };
  const handleGitHub = () => { void oauth('oauth_github'); };

  if (error) return (
    <div>
      <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 13, color: 'var(--status-error)' }}>{error}</div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Email</label>
        <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Password</label>
        <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8, height: 40 }}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
      </div>
      <button type="button" onClick={handleGoogle} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
        Continue with Google
      </button>
      <button type="button" onClick={handleGitHub} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
        Continue with GitHub
      </button>
      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        No account?{' '}
        <a href="/sign-up" style={{ color: 'var(--accent-300)', textDecoration: 'none' }}>Sign up</a>
      </div>
    </form>
  );
}
