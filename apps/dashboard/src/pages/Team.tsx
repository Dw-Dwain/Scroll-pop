import React from 'react';
import { useCustom, useCustomMutation } from '@refinedev/core';
import { Users, Mail, Trash2, Send, Loader2, Crown, ShieldCheck, AlertCircle } from 'lucide-react';
import { getApiBase } from '../providers/dataProvider';
import { usePlan } from '../hooks/usePlan';

interface Member { userId: string; role: string; email: string; name: string | null; isSelf: boolean }
interface Invite { id: string; email: string; role: string; createdAt: string }
interface TeamData { isAgency: boolean; members: Member[]; invites: Invite[] }

const roleBadge = (role: string) => {
  if (role === 'owner') return { label: 'Owner', color: '#f59e0b', icon: Crown };
  if (role === 'admin') return { label: 'Admin', color: 'var(--accent-500)', icon: ShieldCheck };
  return { label: role.charAt(0).toUpperCase() + role.slice(1), color: 'var(--text-muted)', icon: Users };
};

export const Team: React.FC<{ onNavigate?: (path: string) => void }> = ({ onNavigate }) => {
  const { plan, isUnlimited } = usePlan();
  const isAgency = plan === 'agency' || isUnlimited;

  const { data, refetch, isLoading } = useCustom<{ data: TeamData }>({
    url: `${getApiBase()}/team`,
    method: 'get',
    queryOptions: { enabled: isAgency, retry: false },
  });
  const { mutateAsync } = useCustomMutation();

  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<'editor' | 'admin' | 'viewer'>('editor');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [ok, setOk] = React.useState('');

  const team = (data?.data as unknown as TeamData) ?? { isAgency: false, members: [], invites: [] };

  if (!isAgency) {
    return (
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 8px' }}>Team</h1>
        <div style={{ display: 'flex', gap: 10, padding: 16, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <Crown size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Team workspaces are an <strong>Agency-plan</strong> feature. Upgrade to invite employees who share your
            campaigns, sites, and analytics under one coupled login.
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => onNavigate?.('/billing')}>Upgrade to Agency</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setOk('');
    if (!email.trim()) return;
    setBusy(true);
    try {
      await mutateAsync({ url: `${getApiBase()}/team/invites`, method: 'post', values: { email: email.trim(), role } });
      setOk(`Invite sent to ${email.trim()}. They'll see it when they sign in.`);
      setEmail('');
      await refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('409')) setError('That person is already on your team.');
      else if (msg.includes('403')) setError('Only the agency owner can invite team members.');
      else setError('Could not send the invite. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm('Revoke this pending invite?')) return;
    await mutateAsync({ url: `${getApiBase()}/team/invites/${id}`, method: 'delete', values: {} });
    await refetch();
  };

  const removeMember = async (m: Member) => {
    if (!confirm(`Remove ${m.email} from your team? They'll lose access to this workspace.`)) return;
    try {
      await mutateAsync({ url: `${getApiBase()}/team/members/${m.userId}`, method: 'delete', values: {} });
      await refetch();
    } catch {
      alert('Could not remove this member.');
    }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={18} /> Team
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Invite employees to your agency workspace. They sign in with their own login and share all your data.
        </p>
      </div>

      {/* Invite form */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Invite a team member</div>
        <form onSubmit={invite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="email" required className="input" placeholder="employee@company.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1, minWidth: 220, fontSize: 13 }}
          />
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as 'editor' | 'admin' | 'viewer')} style={{ fontSize: 13, width: 130 }}>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            {busy ? <Loader2 size={13} className="spin" /> : <Send size={13} />} Send Invite
          </button>
        </form>
        {error && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: 'var(--status-error)' }}><AlertCircle size={13} /> {error}</div>}
        {ok && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--status-success)' }}>{ok}</div>}
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '10px 0 0' }}>
          The invite is tied to that exact email — they must accept it from an account with the same verified address.
        </p>
      </div>

      {isLoading && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13 }}><Loader2 size={14} className="spin" /> Loading team…</div>}

      {/* Members */}
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
        Members ({team.members.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
        {team.members.map((m) => {
          const b = roleBadge(m.role);
          const Icon = b.icon;
          return (
            <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {(m.name ?? m.email).charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {m.name ?? m.email}{m.isSelf && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (you)</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: b.color, fontWeight: 500 }}>
                <Icon size={12} /> {b.label}
              </span>
              {!m.isSelf && m.role !== 'owner' && (
                <button onClick={() => void removeMember(m)} title="Remove member" className="btn btn-icon" style={{ color: 'var(--text-muted)' }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Pending invites */}
      {team.invites.length > 0 && (
        <>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
            Pending invites ({team.invites.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {team.invites.map((inv) => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px dashed var(--border-default)' }}>
                <Mail size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Invited as {inv.role} · awaiting acceptance</div>
                </div>
                <button onClick={() => void revoke(inv.id)} title="Revoke invite" className="btn btn-icon" style={{ color: 'var(--text-muted)' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
