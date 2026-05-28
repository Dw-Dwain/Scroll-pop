import React from 'react';
import {
  User, Mail, Shield, Key, Check, Sliders,
  Eye, EyeOff, RefreshCw, Copy, LogOut,
  Globe, Smartphone, Monitor, Lock,
  Camera, ChevronRight, Activity, Zap,
  AlertCircle, QrCode, X,
} from 'lucide-react';

interface ProfileProps {
  isDemo: boolean;
  isDesktop?: boolean;
  onNavigate: (path: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, badge, children }: {
  title: string; subtitle?: string; badge?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '18px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: subtitle ? 3 : 0 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>}
        </div>
        {badge}
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {children}
    </label>
  );
}

function StatusMsg({ type, msg }: { type: 'success' | 'error'; msg: string }) {
  if (!msg) return null;
  const isErr = type === 'error';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px',
      background: isErr ? 'rgba(239,68,68,0.07)' : 'rgba(34,197,94,0.07)',
      border: `1px solid ${isErr ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
      borderRadius: 7, fontSize: 12,
      color: isErr ? 'var(--status-error)' : 'var(--status-success)',
      marginTop: 10,
    }}>
      {isErr ? <AlertCircle size={13} /> : <Check size={13} />}
      {msg}
    </div>
  );
}

// ── TOTP (RFC 6238) via Web Crypto API ─────────────────────────────────────

function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const output: number[] = [];
  for (const char of encoded.replace(/=+$/, '').toUpperCase()) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bits -= 8; output.push((value >>> bits) & 0xff); }
  }
  return new Uint8Array(output);
}

function base32Encode(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { bits -= 5; out += alphabet[(value >>> bits) & 31]; }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

async function computeTOTP(secretBase32: string, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', base32Decode(secretBase32).buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 0x100000000), false);
  view.setUint32(4, counter >>> 0, false);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
  const offset = sig[19]! & 0xf;
  const code = ((sig[offset]! & 0x7f) << 24) | (sig[offset + 1]! << 16) | (sig[offset + 2]! << 8) | sig[offset + 3]!;
  return String(code % 1_000_000).padStart(6, '0');
}

async function verifyTOTP(secretBase32: string, token: string): Promise<boolean> {
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (const drift of [-1, 0, 1]) {
    if (await computeTOTP(secretBase32, counter + drift) === token.replace(/\s/g, '')) return true;
  }
  return false;
}

function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return base32Encode(bytes);
}

function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () => {
    const a = crypto.getRandomValues(new Uint8Array(3));
    const b = crypto.getRandomValues(new Uint8Array(3));
    return `${Array.from(a).map(x => x.toString(16).padStart(2, '0')).join('')}-${Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('')}`;
  });
}

// ── Session detection ──────────────────────────────────────────────────────

interface SessionEntry {
  id: string;
  device: string;
  deviceType: 'desktop' | 'mobile';
  location: string;
  createdAt: number;
  current: boolean;
}

function detectDevice(): { label: string; type: 'desktop' | 'mobile' } {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return { label: `Safari on ${/iPad/i.test(ua) ? 'iPad' : 'iPhone'}`, type: 'mobile' };
  if (/Android/i.test(ua)) return { label: `Chrome on Android`, type: 'mobile' };
  const browser = /Edg\//i.test(ua) ? 'Edge' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) && !/Chrome/i.test(ua) ? 'Safari' : 'Chrome';
  const os = /Win/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Unknown OS';
  return { label: `${browser} on ${os}`, type: 'desktop' };
}

function detectLocation(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = tz.split('/');
    if (parts.length >= 2) {
      const city = parts[parts.length - 1];
      if (city) return city.replace(/_/g, ' ');
    }
    return tz;
  } catch { return 'Unknown'; }
}

function loadSessions(): SessionEntry[] {
  try {
    const raw = localStorage.getItem('_sp_sessions');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveSessions(sessions: SessionEntry[]) {
  localStorage.setItem('_sp_sessions', JSON.stringify(sessions));
}

function ensureCurrentSession(sessions: SessionEntry[]): SessionEntry[] {
  const sid = sessionStorage.getItem('_sp_sid') ?? (() => {
    const id = crypto.randomUUID();
    sessionStorage.setItem('_sp_sid', id);
    return id;
  })();
  const existing = sessions.find(s => s.id === sid);
  if (existing) {
    return sessions.map(s => ({ ...s, current: s.id === sid }));
  }
  const { label, type } = detectDevice();
  const newSession: SessionEntry = {
    id: sid,
    device: label,
    deviceType: type,
    location: detectLocation(),
    createdAt: Date.now(),
    current: true,
  };
  return [newSession, ...sessions.map(s => ({ ...s, current: false }))].slice(0, 10);
}

// ── Password validation ────────────────────────────────────────────────────

function validatePassword(pw: string): string[] {
  const errs: string[] = [];
  if (pw.length < 8) errs.push('At least 8 characters');
  if (!/[A-Z]/.test(pw)) errs.push('One uppercase letter');
  if (!/[0-9]/.test(pw)) errs.push('One number');
  return errs;
}

// ── 2FA Modal ─────────────────────────────────────────────────────────────

function TwoFAModal({ secret, backupCodes, onVerify, onCancel }: {
  secret: string; backupCodes: string[];
  onVerify: (code: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [step, setStep] = React.useState<'scan' | 'verify' | 'backup'>('scan');
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState('');
  const [verifying, setVerifying] = React.useState(false);
  const [copiedBackup, setCopiedBackup] = React.useState(false);
  const otpAuthUrl = `otpauth://totp/ScrollPop?secret=${secret}&issuer=ScrollPop`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(otpAuthUrl)}`;

  const handleVerify = async () => {
    if (code.replace(/\s/g, '').length !== 6) { setError('Enter the 6-digit code.'); return; }
    setVerifying(true);
    const ok = await onVerify(code);
    setVerifying(false);
    if (ok) { setStep('backup'); } else { setError('Code incorrect or expired. Try again.'); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-base)', border: '1px solid var(--border-default)',
        borderRadius: 14, width: 440, maxWidth: '95vw', padding: 28,
        boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        position: 'relative',
      }}>
        <button onClick={onCancel} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={16} />
        </button>

        {step === 'scan' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <QrCode size={18} style={{ color: 'var(--accent-500)' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Set up authenticator</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Scan with 1Password, Authy, or Google Authenticator</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <img src={qrUrl} alt="QR code" width={180} height={180} style={{ borderRadius: 8, border: '1px solid var(--border-subtle)', display: 'block' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12 }}>
              Can't scan? Enter this key manually:
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.15em',
              background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
              borderRadius: 7, padding: '10px 14px', textAlign: 'center',
              color: 'var(--accent-300)', wordBreak: 'break-all',
            }}>
              {secret.match(/.{1,4}/g)?.join(' ')}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} onClick={() => setStep('verify')}>
              Continue →
            </button>
          </>
        )}

        {step === 'verify' && (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Verify your code</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
              Enter the 6-digit code shown in your authenticator app.
            </div>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              maxLength={7}
              placeholder="000 000"
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/[^0-9 ]/g, '')); setError(''); }}
              style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 22, letterSpacing: '0.3em', padding: '14px' }}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            />
            {error && <StatusMsg type="error" msg={error} />}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('scan')}>Back</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleVerify} disabled={verifying}>
                {verifying ? 'Verifying…' : 'Verify & Enable'}
              </button>
            </div>
          </>
        )}

        {step === 'backup' && (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Save your backup codes</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Each code can be used once to sign in if you lose access to your authenticator. Store them somewhere safe.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
              {backupCodes.map((c) => (
                <div key={c} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, padding: '7px 10px', background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, color: 'var(--text-secondary)' }}>
                  {c}
                </div>
              ))}
            </div>
            <button
              className="btn btn-secondary btn-sm"
              style={{ gap: 6, marginBottom: 16 }}
              onClick={() => {
                navigator.clipboard.writeText(backupCodes.join('\n'));
                setCopiedBackup(true);
                setTimeout(() => setCopiedBackup(false), 2000);
              }}
            >
              {copiedBackup ? <Check size={12} /> : <Copy size={12} />} {copiedBackup ? 'Copied!' : 'Copy all codes'}
            </button>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onCancel()}>
              <Check size={14} /> Done — 2FA is active
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export const Profile: React.FC<ProfileProps> = ({ isDemo, isDesktop = false, onNavigate }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [toastMsg, setToastMsg] = React.useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        persistProfile({ ...profile, avatarUrl: reader.result as string });
        showToast("Profile avatar updated successfully!");
      };
      reader.readAsDataURL(file);
    }
  };

  const [profile, setProfile] = React.useState(() => {
    try {
      const stored = localStorage.getItem('_sp_profile_v2');
      if (stored) return JSON.parse(stored);
    } catch {}
    try {
      const desktop = localStorage.getItem('desktop_user');
      if (desktop) {
        const u = JSON.parse(desktop);
        return {
          name: u.name ?? 'Dev Admin',
          email: u.email ?? 'admin@scrollpop.local',
          role: 'Admin Manager', avatarUrl: u.avatarUrl ?? '', bio: '',
          developerMode: true, apiKey: `sp_pk_live_${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
          notifDigest: false,
        };
      }
    } catch {}
    return {
      name: 'Dev Admin',
      email: isDesktop ? 'admin@scrollpop.local' : 'admin@scrollpop.dev',
      role: 'Admin Manager', avatarUrl: '', bio: '',
      developerMode: true, apiKey: 'sp_pk_live_a3e8630f904adceddc1d0553d7bcda0c',
      notifDigest: false,
    };
  });

  const [prefs, setPrefs] = React.useState(() => {
    try {
      const raw = localStorage.getItem('_sp_prefs');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { defaultView: 'dashboard', defaultTrigger: 'scroll_pct' };
  });

  const [sessions, setSessions] = React.useState<SessionEntry[]>(() => {
    const all = loadSessions();
    const updated = ensureCurrentSession(all);
    saveSessions(updated);
    return updated;
  });

  const [twoFA, setTwoFA] = React.useState<{ enabled: boolean; secret: string; backupCodes: string[] }>(() => {
    try {
      const raw = localStorage.getItem('_sp_2fa');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { enabled: false, secret: '', backupCodes: [] };
  });

  const [isSaved, setIsSaved] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [showKey, setShowKey] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<'identity' | 'security' | 'preferences' | 'developer'>('identity');

  // Password state
  const [pwCurrent, setPwCurrent] = React.useState('');
  const [pwNew, setPwNew] = React.useState('');
  const [pwConfirm, setPwConfirm] = React.useState('');
  const [showPwCurrent, setShowPwCurrent] = React.useState(false);
  const [showPwNew, setShowPwNew] = React.useState(false);
  const [pwMsg, setPwMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 2FA modal
  const [setup2FA, setSetup2FA] = React.useState<{ secret: string; backupCodes: string[] } | null>(null);

  const storedAuth = (() => {
    try {
      return JSON.parse(localStorage.getItem('_sp_auth') ?? '{}');
    } catch { return {}; }
  })();
  const hasExistingPassword = !!storedAuth.password;

  const persistProfile = (updated: typeof profile) => {
    setProfile(updated);
    localStorage.setItem('_sp_profile_v2', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  };

  const persistPrefs = (updated: typeof prefs) => {
    setPrefs(updated);
    localStorage.setItem('_sp_prefs', JSON.stringify(updated));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    persistProfile(profile);
    if (isDesktop) {
      const token = localStorage.getItem('desktop_token');
      const apiBase = (window as any).electronAPI?.getLocalApiUrl?.() ?? 'http://127.0.0.1:3010';
      try {
        const res = await fetch(`${apiBase}/api/v1/auth/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: profile.name, avatarUrl: profile.avatarUrl }),
        });
        if (res.ok) localStorage.setItem('desktop_user', JSON.stringify((await res.json()).data ?? {}));
      } catch {}
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handlePasswordChange = () => {
    setPwMsg(null);
    const stored = (() => { try { return JSON.parse(localStorage.getItem('_sp_auth') ?? '{}'); } catch { return {}; } })();
    if (stored.password && stored.password !== pwCurrent) {
      setPwMsg({ type: 'error', text: 'Current password is incorrect.' });
      return;
    }
    const errs = validatePassword(pwNew);
    if (errs.length > 0) { setPwMsg({ type: 'error', text: `Password must have: ${errs.join(', ')}.` }); return; }
    if (pwNew !== pwConfirm) { setPwMsg({ type: 'error', text: 'New passwords do not match.' }); return; }
    localStorage.setItem('_sp_auth', JSON.stringify({ ...stored, password: pwNew, updatedAt: Date.now() }));
    setPwCurrent(''); setPwNew(''); setPwConfirm('');
    setPwMsg({ type: 'success', text: 'Password updated successfully.' });
    showToast("Password updated successfully!");
    setTimeout(() => setPwMsg(null), 4000);
  };

  const handleEnable2FA = () => {
    const secret = generateSecret();
    const backupCodes = generateBackupCodes();
    setSetup2FA({ secret, backupCodes });
  };

  const handleVerify2FA = async (code: string): Promise<boolean> => {
    if (!setup2FA) return false;
    const ok = await verifyTOTP(setup2FA.secret, code);
    if (ok) {
      const updated = { enabled: true, secret: setup2FA.secret, backupCodes: setup2FA.backupCodes };
      setTwoFA(updated);
      localStorage.setItem('_sp_2fa', JSON.stringify(updated));
    }
    return ok;
  };

  const handleDisable2FA = () => {
    const updated = { enabled: false, secret: '', backupCodes: [] };
    setTwoFA(updated);
    localStorage.setItem('_sp_2fa', JSON.stringify(updated));
    setSetup2FA(null);
  };

  const handleRevokeSession = (id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    saveSessions(updated);
  };

  const handleRevokeAllOther = () => {
    const updated = sessions.filter(s => s.current);
    setSessions(updated);
    saveSessions(updated);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(profile.apiKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleRollKey = () => {
    const newKey = `sp_pk_live_${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    persistProfile({ ...profile, apiKey: newKey });
  };

  const initials = (profile.name || 'A').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const SECTIONS = [
    { id: 'identity' as const,    label: 'Identity',     icon: User },
    { id: 'security' as const,    label: 'Security',     icon: Shield },
    { id: 'preferences' as const, label: 'Preferences',  icon: Sliders },
    { id: 'developer' as const,   label: 'Developer',    icon: Key },
  ];

  const timeAgo = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  return (
    <section style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Left panel — sticky */}
      <div style={{
        width: 240, flexShrink: 0,
        padding: '32px 24px',
        borderRight: '1px solid var(--border-subtle)',
        height: '100%', overflowY: 'auto',
        background: 'var(--bg-surface)',
      }}>
          {/* Avatar summary */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 0 20px', marginBottom: 8 }}>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: profile.avatarUrl ? 'transparent' : 'var(--accent-500)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700, color: '#fff',
                border: '2px solid var(--border-subtle)', overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                cursor: 'pointer',
              }} onClick={() => fileInputRef.current?.click()}>
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : initials}
              </div>
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 20, height: 20, borderRadius: '50%',
                background: 'var(--bg-base)', border: '1px solid var(--border-default)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }} onClick={() => fileInputRef.current?.click()}>
                <Camera size={10} style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 2 }}>{profile.name || 'No name'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>{profile.email}</div>
            <span className="badge badge-accent" style={{ fontSize: 9, marginTop: 8 }}>{profile.role}</span>
          </div>

          {/* Section nav */}
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`nav-item${activeSection === id ? ' active' : ''}`}
              style={{ width: '100%', marginBottom: 2 }}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}

          {/* Account info */}
          <div style={{ marginTop: 20, padding: '14px', background: 'var(--bg-raised)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Account Info</div>
            {[
              { label: 'Member since', value: 'Jan 2026' },
              { label: 'Last login', value: 'Today' },
              { label: 'Plan', value: 'Agency' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

      {/* Content — centered in remaining space */}
      <div style={{ flex: 1, overflowY: 'auto', height: '100%', padding: '32px 48px 120px', display: 'flex', justifyContent: 'center', minWidth: 0 }}>
        <div style={{ width: '100%', maxWidth: 720 }}>
          <form onSubmit={handleSave}>

            {/* ── IDENTITY ── */}
            {activeSection === 'identity' && (
              <div>
                <SectionCard title="Personal Information" subtitle="Your name and contact details visible to your team.">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <FieldLabel>Full Name</FieldLabel>
                      <input className="input" type="text" required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                    </div>
                    <div>
                      <FieldLabel>Email Address</FieldLabel>
                      <input className="input" type="email" required value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                    </div>
                    <div>
                      <FieldLabel>Role</FieldLabel>
                      <select className="input" value={profile.role} onChange={(e) => setProfile({ ...profile, role: e.target.value })}>
                        <option value="Admin Manager">Admin Manager</option>
                        <option value="Lead Developer">Lead Developer</option>
                        <option value="Editor Creative">Editor Creative</option>
                        <option value="Marketing Owner">Marketing Owner</option>
                        <option value="Analyst">Analyst</option>
                        <option value="Viewer">Viewer</option>
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Avatar URL</FieldLabel>
                      <input
                        className="input"
                        type="text"
                        placeholder="https://example.com/avatar.jpg"
                        value={profile.avatarUrl}
                        onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <FieldLabel>Bio</FieldLabel>
                    <textarea
                      className="input"
                      placeholder="A short bio visible to your team..."
                      value={profile.bio}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                      rows={3}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  title="Sign-in Methods"
                  subtitle="How you authenticate to ScrollPop."
                  badge={<span className="badge badge-success" style={{ fontSize: 9 }}>Verified</span>}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { method: 'Email / Password', detail: profile.email, icon: Mail, active: true },
                      { method: 'Google', detail: 'Not connected', icon: Globe, active: false },
                      { method: 'GitHub', detail: 'Not connected', icon: Key, active: false },
                    ].map(({ method, detail, icon: Icon, active }) => (
                      <div key={method} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', border: '1px solid var(--border-subtle)', borderRadius: 8,
                        background: active ? 'var(--bg-raised)' : 'var(--bg-surface)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={14} style={{ color: 'var(--text-muted)' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{method}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{detail}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {active && <span className="badge badge-success" style={{ fontSize: 9 }}>Active</span>}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11 }}
                            onClick={() => {
                              if (active) {
                                showToast("Manage credentials is only active for production Clerk sessions.");
                              } else {
                                showToast(`Initiating OAuth connection flow for ${method}... (Simulated in developer mode)`);
                              }
                            }}
                          >
                            {active ? 'Manage' : 'Connect'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ── SECURITY ── */}
            {activeSection === 'security' && (
              <div>
                {/* 2FA */}
                <SectionCard title="Two-Factor Authentication" subtitle="Add an extra layer of security to your account.">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: twoFA.enabled ? 16 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 10,
                        background: twoFA.enabled ? 'rgba(34,197,94,0.1)' : 'var(--bg-raised)',
                        border: `1px solid ${twoFA.enabled ? 'rgba(34,197,94,0.3)' : 'var(--border-subtle)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Shield size={20} style={{ color: twoFA.enabled ? 'var(--status-success)' : 'var(--text-muted)' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                          Authenticator App
                          {twoFA.enabled && <span className="badge badge-success" style={{ fontSize: 9, marginLeft: 8 }}>Enabled</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {twoFA.enabled
                            ? 'TOTP authenticator is active on this account.'
                            : 'Use 1Password, Authy, or Google Authenticator.'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`btn ${twoFA.enabled ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                      style={{ flexShrink: 0 }}
                      onClick={twoFA.enabled ? handleDisable2FA : handleEnable2FA}
                    >
                      {twoFA.enabled ? 'Disable 2FA' : 'Enable 2FA'}
                    </button>
                  </div>

                  {twoFA.enabled && (
                    <div style={{ padding: '14px 16px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Recovery Codes</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                        {twoFA.backupCodes.length} codes remaining. Each can be used once if you lose access to your device.
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ gap: 6 }}
                        onClick={() => navigator.clipboard.writeText(twoFA.backupCodes.join('\n'))}
                      >
                        <Copy size={12} /> Copy Backup Codes
                      </button>
                    </div>
                  )}
                </SectionCard>

                {/* Password */}
                <SectionCard title="Password" subtitle="Change your sign-in password.">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {hasExistingPassword ? (
                      <div>
                        <FieldLabel>Current Password</FieldLabel>
                        <div style={{ position: 'relative' }}>
                          <input
                            className="input"
                            type={showPwCurrent ? 'text' : 'password'}
                            placeholder="••••••••••••"
                            value={pwCurrent}
                            onChange={(e) => setPwCurrent(e.target.value)}
                            style={{ paddingRight: 38 }}
                          />
                          <button type="button" onClick={() => setShowPwCurrent(v => !v)}
                            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                            {showPwCurrent ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', padding: '14px', background: 'rgba(34,197,94,0.04)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.1)' }}>
                        <div style={{ fontSize: 12, color: 'var(--status-success)', fontWeight: 500 }}>
                          No current password stored. Set up your new password below!
                        </div>
                      </div>
                    )}
                    <div />
                    <div>
                      <FieldLabel>New Password</FieldLabel>
                      <div style={{ position: 'relative' }}>
                        <input
                          className="input"
                          type={showPwNew ? 'text' : 'password'}
                          placeholder="Min 8 chars, 1 uppercase, 1 number"
                          value={pwNew}
                          onChange={(e) => setPwNew(e.target.value)}
                          style={{ paddingRight: 38 }}
                        />
                        <button type="button" onClick={() => setShowPwNew(v => !v)}
                          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                          {showPwNew ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                      {pwNew && validatePassword(pwNew).length > 0 && (
                        <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {['8+ chars', '1 uppercase', '1 number'].map((req, i) => {
                            const checks = [pwNew.length >= 8, /[A-Z]/.test(pwNew), /[0-9]/.test(pwNew)];
                            return (
                              <span key={req} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: checks[i] ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)', color: checks[i] ? 'var(--status-success)' : 'var(--status-error)', border: `1px solid ${checks[i] ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>{req}</span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div>
                      <FieldLabel>Confirm New Password</FieldLabel>
                      <input
                        className="input"
                        type="password"
                        placeholder="••••••••••••"
                        value={pwConfirm}
                        onChange={(e) => setPwConfirm(e.target.value)}
                        style={{ borderColor: pwConfirm && pwConfirm !== pwNew ? 'var(--status-error)' : undefined }}
                      />
                    </div>
                  </div>
                  {pwMsg && <StatusMsg type={pwMsg.type} msg={pwMsg.text} />}
                  <div style={{ marginTop: 14 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ gap: 6 }}
                      onClick={handlePasswordChange}
                      disabled={(hasExistingPassword ? !pwCurrent : false) || !pwNew || !pwConfirm}
                    >
                      <Lock size={12} /> {hasExistingPassword ? 'Update Password' : 'Create Password'}
                    </button>
                  </div>
                </SectionCard>

                {/* Sessions */}
                <SectionCard title="Active Sessions" subtitle="Devices currently signed in to your account.">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sessions.length === 0 ? (
                      <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>No sessions recorded.</div>
                    ) : sessions.map((s) => {
                      const Icon = s.deviceType === 'mobile' ? Smartphone : Monitor;
                      return (
                        <div key={s.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 14px', border: `1px solid ${s.current ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)'}`,
                          borderRadius: 8, background: s.current ? 'rgba(99,102,241,0.04)' : 'var(--bg-surface)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 8,
                              background: s.current ? 'rgba(99,102,241,0.1)' : 'var(--bg-raised)',
                              border: `1px solid ${s.current ? 'rgba(99,102,241,0.2)' : 'var(--border-subtle)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Icon size={15} style={{ color: s.current ? 'var(--accent-500)' : 'var(--text-muted)' }} />
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{s.device}</span>
                                {s.current && <span className="badge badge-accent" style={{ fontSize: 9 }}>This device</span>}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                                <span>{s.location}</span>
                                <span>·</span>
                                <span>{s.current ? 'Now' : timeAgo(s.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          {!s.current && (
                            <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: 11, color: 'var(--status-error)', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => handleRevokeSession(s.id)}>
                              Revoke
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {sessions.filter(s => !s.current).length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ gap: 6, color: 'var(--status-error)', borderColor: 'rgba(239,68,68,0.3)' }} onClick={handleRevokeAllOther}>
                        <LogOut size={12} /> Sign out all other sessions
                      </button>
                    </div>
                  )}
                </SectionCard>
              </div>
            )}

            {/* ── PREFERENCES ── */}
            {activeSection === 'preferences' && (
              <div>
                <SectionCard title="Workspace Preferences" subtitle="Customize how the dashboard behaves for you. Changes take effect immediately.">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <FieldLabel>Default Landing Page</FieldLabel>
                      <select
                        className="input"
                        value={prefs.defaultView}
                        onChange={(e) => persistPrefs({ ...prefs, defaultView: e.target.value })}
                      >
                        <option value="dashboard">Dashboard</option>
                        <option value="campaigns">Campaigns</option>
                        <option value="analytics">Analytics</option>
                        <option value="sites">Sites</option>
                      </select>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                        Where you land after signing in.
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Default Campaign Trigger</FieldLabel>
                      <select
                        className="input"
                        value={prefs.defaultTrigger}
                        onChange={(e) => persistPrefs({ ...prefs, defaultTrigger: e.target.value })}
                      >
                        <option value="scroll_pct">Scroll Percentage</option>
                        <option value="dwell_time">Dwell Time</option>
                        <option value="exit_intent">Exit Intent</option>
                        <option value="inactivity">Inactivity</option>
                        <option value="time_delay">Time Delay</option>
                      </select>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                        Pre-selected when creating campaigns.
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Notification Preferences" subtitle="Personal notification settings (overrides workspace defaults).">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>Weekly performance digest</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Summary emailed every Monday morning</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => persistProfile({ ...profile, notifDigest: !profile.notifDigest })}
                      style={{
                        width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                        background: profile.notifDigest ? 'var(--accent-500)' : 'var(--bg-overlay)',
                        border: `1px solid ${profile.notifDigest ? 'var(--accent-600)' : 'var(--border-default)'}`,
                        cursor: 'pointer', position: 'relative', transition: 'background 200ms',
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 2, left: profile.notifDigest ? 17 : 2,
                        width: 14, height: 14, borderRadius: '50%', background: '#fff',
                        transition: 'left 180ms var(--ease-spring)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>
                </SectionCard>

                <SectionCard title="Keyboard Shortcuts" subtitle="Quick actions available throughout the app.">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { key: '⌘ K', action: 'Command palette' },
                      { key: '⌘ N', action: 'New campaign' },
                      { key: '⌘ /', action: 'Search' },
                      { key: '⌘ ⇧ D', action: 'Go to Dashboard' },
                      { key: '⌘ ⇧ C', action: 'Go to Campaigns' },
                      { key: '⌘ ⇧ A', action: 'Go to Analytics' },
                    ].map(({ key, action }) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-raised)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{action}</span>
                        <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 4, padding: '2px 6px' }}>{key}</kbd>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ── DEVELOPER ── */}
            {activeSection === 'developer' && (
              <div>
                <SectionCard
                  title="Developer API Access"
                  subtitle="Personal API key for authenticating with the ScrollPop REST API."
                  badge={
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={profile.developerMode}
                        onChange={(e) => persistProfile({ ...profile, developerMode: e.target.checked })}
                        style={{ accentColor: 'var(--accent-500)', cursor: 'pointer' }}
                      />
                      Enable
                    </label>
                  }
                >
                  {profile.developerMode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="badge badge-success" style={{ fontSize: 10 }}>Live</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Created May 2026</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Activity size={11} /> Last used: today
                        </span>
                      </div>

                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
                        borderRadius: 8, padding: '10px 14px',
                      }}>
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {showKey ? profile.apiKey : `sp_pk_live_${'•'.repeat(32)}`}
                        </code>
                        <button type="button" className="btn btn-icon btn-sm" onClick={() => setShowKey(v => !v)} title={showKey ? 'Hide' : 'Reveal'}>
                          {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        <button type="button" className="btn btn-icon btn-sm" onClick={handleCopyKey} title="Copy">
                          {copied ? <Check size={13} style={{ color: 'var(--status-success)' }} /> : <Copy size={13} />}
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ gap: 5 }} onClick={handleRollKey}>
                          <RefreshCw size={12} /> Roll Key
                        </button>
                      </div>

                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                        Identifies your account when making API requests. Keep this secret — treat it like a password.
                      </p>

                      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-raised)' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Quick Start</div>
                        </div>
                        <div style={{ padding: '12px 16px', background: 'var(--bg-raised)' }}>
                          <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: '19px', color: 'var(--accent-300)', margin: 0, whiteSpace: 'pre-wrap' }}>{`curl https://api.scrollpop.io/v1/campaigns \\
  -H "Authorization: Bearer ${showKey ? profile.apiKey : 'sp_pk_live_...'}" \\
  -H "Content-Type: application/json"`}</pre>
                        </div>
                      </div>

                      <a
                        href="/docs"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--accent-300)', textDecoration: 'none' }}
                      >
                        <Zap size={13} /> View API Documentation <ChevronRight size={12} />
                      </a>
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Key size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
                      <div style={{ fontSize: 13, marginBottom: 4 }}>Developer access is disabled.</div>
                      <div style={{ fontSize: 12 }}>Enable it above to generate your API key.</div>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Rate Limits" subtitle="API request limits for your account tier.">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {[
                      { label: 'Requests / min', value: '1,000', color: 'var(--status-success)' },
                      { label: 'Requests / day', value: '50,000', color: 'var(--status-info)' },
                      { label: 'Burst limit', value: '100 req/s', color: 'var(--status-warning)' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ padding: '16px', background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{value}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
            )}

            {/* Save */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', marginTop: 24, marginBottom: 32 }}>
              <button type="button" onClick={() => onNavigate('/dashboard')} className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ gap: 7, minWidth: 130 }}>
                {isSaved ? <><Check size={14} /> Saved</> : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
        </div>
      
      {/* 2FA Setup Modal */}
      {setup2FA && (
        <TwoFAModal
          secret={setup2FA.secret}
          backupCodes={setup2FA.backupCodes}
          onVerify={handleVerify2FA}
          onCancel={() => setSetup2FA(null)}
        />
      )}

      {/* Floating Premium Toast notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: 10, padding: '14px 20px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: 10,
          animation: 'slide-up 200ms ease-out',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-500)' }} />
          <span style={{ fontSize: 13, fontWeight: 550, color: 'var(--text-primary)' }}>{toastMsg}</span>
        </div>
      )}
    </section>
  );
};
