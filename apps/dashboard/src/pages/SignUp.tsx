import React from 'react';
import { useSignUp } from '@clerk/clerk-react';

interface SignUpProps {
  isDemo?: boolean;
  onSignUp?: () => void;
}

export const SignUp: React.FC<SignUpProps> = ({ isDemo = false, onSignUp }) => {
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

          {isDemo ? <DemoSignUpForm onSignUp={onSignUp} /> : <ClerkSignUpForm />}

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <a href="/sign-in" style={{ color: 'var(--accent-300)', textDecoration: 'none' }}>Sign in</a>
          </div>
        </div>
      </div>
    </div>
  );
};

const fieldLabel: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 };
const errorBox: React.CSSProperties = { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 13, color: 'var(--status-error)' };

function DemoSignUpForm({ onSignUp }: { onSignUp?: (() => void) | undefined }) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSignUp?.();
    }, 600);
  };

  return (
    <>
      {error && <div style={errorBox}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={fieldLabel}>Full Name</label>
          <input type="text" className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label style={fieldLabel}>Email</label>
          <input type="email" className="input" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label style={fieldLabel}>Password</label>
          <input type="password" className="input" placeholder="Minimum 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8, height: 40 }}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </>
  );
}

function ClerkSignUpForm() {
  const { signUp, isLoaded, setActive } = useSignUp();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
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
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? 'Sign up failed.');
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
        window.location.href = '/dashboard';
      } else {
        setError('Verification incomplete. Please check the code and try again.');
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    signUp?.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/dashboard',
    });
  };

  const handleGitHub = () => {
    signUp?.authenticateWithRedirect({
      strategy: 'oauth_github',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/dashboard',
    });
  };

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
