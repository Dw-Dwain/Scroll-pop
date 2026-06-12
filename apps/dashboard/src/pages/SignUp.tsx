import React from 'react';
import { useSignUp } from '@clerk/clerk-react';

export const SignUp: React.FC = () => {
  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-root)' }}>
      {/* Left panel */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 48,
          borderRight: '1px solid var(--border-subtle)',
          background: 'var(--bg-root)',
          backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.1) 0%, transparent 60%)',
        }}
        className="hidden md:flex"
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, marginBottom: 48 }}>
          scrollpop
        </div>
        <p style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', lineHeight: '30px', maxWidth: 320, letterSpacing: '-0.01em' }}>
          Start converting visitors into customers today.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12, maxWidth: 300 }}>
          Free plan. No credit card required. Up to 1,000 popup views per month.
        </p>
      </div>

      {/* Right panel */}
      <div style={{
        width: '100%', maxWidth: 480,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 32,
        background: 'var(--bg-surface)',
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <h2 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
            Create your account
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 24px' }}>
            Start free. Upgrade when you grow.
          </p>

          <ClerkSignUpForm />

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <a href={`/sign-in${typeof window !== 'undefined' ? window.location.search : ''}`} style={{ color: 'var(--accent-300)', textDecoration: 'none' }}>Sign in</a>
          </div>
        </div>
      </div>
    </div>
  );
};

const fieldLabel: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 };
const errorBox: React.CSSProperties = { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 13, color: 'var(--status-error)' };

// Read `?email=` (prefill) and `?redirect=` (post-auth destination) from the URL. Used by the
// team-invite deep link so a new invitee signs up with the exact invited address and is returned
// to /accept-invite to finish. `redirect` is restricted to a same-origin path (no open redirect).
export function readAuthParams(): { email: string; redirect: string } {
  try {
    const p = new URLSearchParams(window.location.search);
    const email = p.get('email') ?? '';
    const r = p.get('redirect') ?? '';
    const redirect = r.startsWith('/') && !r.startsWith('//') ? r : '/dashboard';
    return { email, redirect };
  } catch { return { email: '', redirect: '/dashboard' }; }
}

function ClerkSignUpForm() {
  const { signUp, isLoaded, setActive } = useSignUp();
  const params = React.useMemo(readAuthParams, []);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState(params.email);
  const [password, setPassword] = React.useState('');
  const [code, setCode] = React.useState('');
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setError('');
    try {
      const [firstName, ...rest] = name.trim().split(/\s+/);
      const lastName = rest.join(' ');
      await signUp.create({
        emailAddress: email,
        password,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ longMessage?: string; message?: string }> };
      setError(clerkErr?.errors?.[0]?.longMessage ?? clerkErr?.errors?.[0]?.message ?? 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;
    setLoading(true);
    setError('');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        window.location.href = params.redirect;
      } else {
        setError('Verification incomplete. Please check the code and try again.');
      }
    } catch (err: unknown) {
      const clerkVerErr = err as { errors?: Array<{ longMessage?: string; message?: string }> };
      setError(clerkVerErr?.errors?.[0]?.longMessage ?? clerkVerErr?.errors?.[0]?.message ?? 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // OAuth: use ABSOLUTE redirect URLs (Clerk can silently no-op on relative ones) and
  // surface any failure instead of failing silently.
  const oauth = async (strategy: 'oauth_google' | 'oauth_github') => {
    if (!isLoaded || !signUp) return;
    setError('');
    try {
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}${params.redirect}`,
      });
    } catch (err: unknown) {
      const clerkOauthErr = err as { errors?: Array<{ message?: string }> };
      setError(clerkOauthErr?.errors?.[0]?.message ?? 'Could not continue with that provider. Please try again.');
    }
  };
  const handleGoogle = () => { void oauth('oauth_google'); };
  const handleGitHub = () => { void oauth('oauth_github'); };

  if (pendingVerification) {
    return (
      <>
        {error && <div style={errorBox}>{error}</div>}
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
          We sent a verification code to <strong>{email}</strong>. Enter it below to finish.
        </p>
        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={fieldLabel}>Verification code</label>
            <input type="text" inputMode="numeric" className="input" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="one-time-code" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8, height: 40 }}>
            {loading ? 'Verifying…' : 'Verify & continue'}
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      {error && <div style={errorBox}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={fieldLabel}>Full Name</label>
          <input type="text" className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </div>
        <div>
          <label style={fieldLabel}>Email</label>
          <input type="email" className="input" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <label style={fieldLabel}>Password</label>
          <input type="password" className="input" placeholder="Minimum 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        </div>
        {/* Clerk Smart CAPTCHA mounts here when bot protection is enabled */}
        <div id="clerk-captcha" />
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8, height: 40 }}>
          {loading ? 'Creating account…' : 'Create account'}
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
      </form>
    </>
  );
}
