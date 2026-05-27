import React from 'react';
import { User, Mail, Shield, Key, Check, Sliders } from 'lucide-react';

interface ProfileProps {
  isDemo: boolean;
  isDesktop?: boolean;
  onNavigate: (path: string) => void;
}

export const Profile: React.FC<ProfileProps> = ({ isDemo, isDesktop = false, onNavigate }) => {
  const [profile, setProfile] = React.useState({
    name: 'Dev Admin',
    email: isDesktop ? 'admin@scrollpop.local' : 'admin@scrollpop.dev',
    role: 'Admin Manager',
    avatar: '',
    developerMode: true,
    defaultTrigger: 'scroll_pct',
    apiKey: 'sp_pk_live_a3e8630f904adceddc1d0553d7bcda0c',
  });
  const [isSaved, setIsSaved] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const desktopUser = localStorage.getItem('desktop_user');
    if (desktopUser) {
      try {
        const u = JSON.parse(desktopUser);
        setProfile((p) => ({ ...p, name: u.name ?? p.name, email: u.email ?? p.email, avatar: u.avatarUrl ?? p.avatar }));
        return;
      } catch {}
    }
    const stored = localStorage.getItem('_sp_profile');
    if (stored) {
      try { setProfile(JSON.parse(stored)); } catch {}
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('_sp_profile', JSON.stringify(profile));
    if (isDesktop) {
      const token = localStorage.getItem('desktop_token');
      const apiBase = (window as any).electronAPI?.getLocalApiUrl?.() ?? 'http://127.0.0.1:3010';
      try {
        const res = await fetch(`${apiBase}/api/v1/auth/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: profile.name, avatarUrl: profile.avatar }),
        });
        if (res.ok) localStorage.setItem('desktop_user', JSON.stringify((await res.json()).data ?? {}));
      } catch {}
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    window.dispatchEvent(new Event('storage'));
  };

  const handleGenerateKey = () => {
    const newKey = `sp_pk_live_${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    setProfile({ ...profile, apiKey: newKey });
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(profile.apiKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const initials = profile.name.slice(0, 2).toUpperCase();

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, marginBottom: 4, letterSpacing: '-0.01em' }}>Profile</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Manage your account details and developer credentials.
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Avatar + identity */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 16 }}>Identity</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
              background: profile.avatar ? 'transparent' : 'var(--accent-500)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 600, color: '#fff',
              border: '1px solid var(--border-subtle)', overflow: 'hidden',
            }}>
              {profile.avatar ? (
                <img src={profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : initials}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{profile.name || 'No name'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{profile.email}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Full Name
              </label>
              <input
                className="input"
                type="text"
                required
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Email Address
              </label>
              <input
                className="input"
                type="email"
                required
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Role
              </label>
              <select
                className="input"
                value={profile.role}
                onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                style={{ width: '100%' }}
              >
                <option value="Admin Manager">Admin Manager</option>
                <option value="Lead Developer">Lead Developer</option>
                <option value="Editor Creative">Editor Creative</option>
                <option value="Marketing Owner">Marketing Owner</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Default Trigger
              </label>
              <select
                className="input"
                value={profile.defaultTrigger}
                onChange={(e) => setProfile({ ...profile, defaultTrigger: e.target.value })}
                style={{ width: '100%' }}
              >
                <option value="scroll_pct">Scroll Percentage</option>
                <option value="dwell_time">Dwell Time</option>
                <option value="inactivity">Inactivity</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Avatar URL
            </label>
            <input
              className="input"
              type="text"
              placeholder="https://example.com/avatar.jpg"
              value={profile.avatar}
              onChange={(e) => setProfile({ ...profile, avatar: e.target.value })}
              style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12 }}
            />
          </div>
        </div>

        {/* Developer Credentials */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 16 }}>
            Developer Credentials
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: profile.developerMode ? 16 : 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={profile.developerMode}
                onChange={(e) => setProfile({ ...profile, developerMode: e.target.checked })}
                style={{ accentColor: 'var(--accent-500)', cursor: 'pointer' }}
              />
              Enable Developer API Access
            </label>
          </div>

          {profile.developerMode && (
            <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Edge Public Key</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{
                  flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)',
                  background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4,
                  padding: '6px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  display: 'block',
                }}>
                  {profile.apiKey}
                </code>
                <button type="button" onClick={handleCopyKey} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
                  {copied ? <><Check size={12} /> Copied</> : 'Copy'}
                </button>
                <button type="button" onClick={handleGenerateKey} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
                  Roll Key
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                Identifies your sites when requesting affiliate popup schedules from the edge layer.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={() => onNavigate('/dashboard')} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}>
            {isSaved ? <><Check size={14} /> Saved</> : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
