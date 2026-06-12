import React from 'react';
import { useUser, useAuth, useClerk } from '@clerk/clerk-react';
import { Users, Check, Loader2, AlertCircle, LogOut } from 'lucide-react';
import { getApiBase } from '../providers/dataProvider';

/**
 * Team-invite accept page (deep link: /accept-invite?invite=<id>).
 *
 * Why this exists: the invite flow used to be "email-match + banner only" — the invitee had to
 * already be signed in as the exact invited address for the dashboard banner to appear, and the
 * email link carried no context. If they were signed in as a *different* account (or the invited
 * address had no account yet) they silently saw nothing. This page makes the invite the entry
 * point regardless of session state:
 *   - signed out            → sign up / in with the invited email (prefilled), returns here
 *   - signed in, email match → accepts and drops them into the shared workspace
 *   - signed in, wrong email → tells them, with a one-click switch-account
 *
 * Rendered OUTSIDE the Refine <SignedIn> tree (see main.tsx), so it cannot rely on the data
 * provider's token getter — it calls Clerk's getToken() directly for the authenticated accept.
 */
interface InviteInfo { id: string; role: string; email: string; tenantName: string }

type Status = 'loading' | 'notfound' | 'ready' | 'accepting' | 'accepted' | 'error';

function getInviteId(): string | null {
  try { return new URLSearchParams(window.location.search).get('invite'); } catch { return null; }
}

// getApiBase() returns either an absolute "https://host/api/v1" or a relative "/api/v1".
function apiUrl(path: string): string {
  const base = getApiBase();
  return base.startsWith('http') ? `${base}${path}` : `${window.location.origin}${base}${path}`;
}

const card: React.CSSProperties = {
  width: '100%', maxWidth: 420, background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 28,
};

export const AcceptInvite: React.FC = () => {
  const { isLoaded: userLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();

  const inviteId = React.useMemo(getInviteId, []);
  const [info, setInfo] = React.useState<InviteInfo | null>(null);
  const [status, setStatus] = React.useState<Status>('loading');
  const [errorMsg, setErrorMsg] = React.useState('');

  // 1) Load public invite context.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!inviteId) { setStatus('notfound'); return; }
      try {
        const res = await fetch(apiUrl(`/public/invite-info/${inviteId}`));
        if (!res.ok) { if (!cancelled) setStatus('notfound'); return; }
        const body = await res.json() as { data: InviteInfo };
        if (!cancelled) { setInfo(body.data); setStatus('ready'); }
      } catch { if (!cancelled) setStatus('notfound'); }
    })();
    return () => { cancelled = true; };
  }, [inviteId]);

  const myEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '';
  const inviteEmail = info?.email?.toLowerCase() ?? '';
  const emailMatches = !!myEmail && myEmail === inviteEmail;

  // 2) When signed in with the matching email, accept automatically.
  React.useEffect(() => {
    if (status !== 'ready' || !userLoaded || !isSignedIn || !info || !emailMatches) return;
    let cancelled = false;
    void (async () => {
      setStatus('accepting');
      try {
        const token = await getToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(apiUrl(`/team/invites/${info.id}/accept`), { method: 'POST', headers, body: '{}' });
        if (!res.ok) throw new Error(String(res.status));
        if (!cancelled) {
          setStatus('accepted');
          // Full reload into the dashboard so tenant-context re-routes them to the shared workspace.
          window.setTimeout(() => { window.location.href = '/dashboard'; }, 1200);
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg('We couldn\'t accept this invite. It must be accepted from an account whose verified email matches the invited address.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [status, userLoaded, isSignedIn, info, emailMatches, getToken]);

  const acceptPath = info ? `/accept-invite?invite=${info.id}` : '/accept-invite';
  const signUpHref = info ? `/sign-up?email=${encodeURIComponent(info.email)}&redirect=${encodeURIComponent(acceptPath)}` : '/sign-up';
  const signInHref = info ? `/sign-in?email=${encodeURIComponent(info.email)}&redirect=${encodeURIComponent(acceptPath)}` : '/sign-in';

  const switchAccount = () => { void signOut({ redirectUrl: acceptPath }); };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg-root)' }}>
      <div style={card}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, marginBottom: 20 }}>scrollpop</div>

        {/* Loading invite context, or waiting for Clerk to resolve the session. */}
        {(status === 'loading' || !userLoaded) && status !== 'notfound' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 14 }}>
            <Loader2 size={16} className="spin" /> Loading your invitation…
          </div>
        )}

        {status === 'notfound' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--status-error)' }}>
              <AlertCircle size={18} /> <strong style={{ fontSize: 15 }}>Invite unavailable</strong>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>
              This invitation link is invalid, was revoked, or has already been accepted.
            </p>
            <a href="/dashboard" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>Go to dashboard</a>
          </>
        )}

        {userLoaded && info && (status === 'ready' || status === 'accepting' || status === 'accepted' || status === 'error') && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(var(--accent-rgb),0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={18} style={{ color: 'var(--accent-500)' }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                Join <strong>{info.tenantName}</strong> as <strong>{info.role}</strong>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>
              Accepting shares {info.tenantName}'s campaigns, sites, and analytics with you. This invite is for{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{info.email}</strong>.
            </p>

            {/* Accepting / accepted / error feedback (signed in + email matches). */}
            {status === 'accepting' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 14 }}>
                <Loader2 size={16} className="spin" /> Joining {info.tenantName}…
              </div>
            )}
            {status === 'accepted' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--status-success)', fontSize: 14 }}>
                <Check size={16} /> You've joined {info.tenantName}. Taking you in…
              </div>
            )}
            {status === 'error' && (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: 'var(--status-error)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} /> {errorMsg}
                </div>
                <button onClick={switchAccount} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <LogOut size={14} /> Sign in with a different account
                </button>
              </>
            )}

            {/* Signed out → sign up / sign in with the invited email (prefilled). */}
            {status === 'ready' && !isSignedIn && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <a href={signUpHref} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Create account &amp; accept</a>
                <a href={signInHref} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>I already have an account</a>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', margin: '4px 0 0' }}>
                  Use <strong>{info.email}</strong> — the invite is tied to that exact address.
                </p>
              </div>
            )}

            {/* Signed in as the WRONG account → explain + switch. */}
            {status === 'ready' && isSignedIn && !emailMatches && (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 16 }}>
                  <AlertCircle size={15} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    You're signed in as <strong>{myEmail || 'another account'}</strong>, but this invite is for{' '}
                    <strong>{info.email}</strong>. Sign in with the invited address to accept it.
                  </div>
                </div>
                <button onClick={switchAccount} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <LogOut size={14} /> Sign in as {info.email}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
