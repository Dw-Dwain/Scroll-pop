import React from 'react';

interface SignUpProps {
  isDemo?: boolean;
  onSignUp?: () => void;
}

export const SignUp: React.FC<SignUpProps> = ({ isDemo = false, onSignUp }) => {
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

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 13, color: 'var(--status-error)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Full Name</label>
              <input type="text" className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Email</label>
              <input type="email" className="input" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Password</label>
              <input type="password" className="input" placeholder="Minimum 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 8, height: 40 }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <a href="/sign-in" style={{ color: 'var(--accent-300)', textDecoration: 'none' }}>Sign in</a>
          </div>
        </div>
      </div>
    </div>
  );
};
