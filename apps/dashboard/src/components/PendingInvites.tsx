import React from 'react';
import { useCustom, useCustomMutation } from '@refinedev/core';
import { Users, Check, X, Loader2 } from 'lucide-react';
import { getApiBase } from '../providers/dataProvider';

interface PendingInvite {
  id: string;
  role: string;
  tenantId: string;
  tenantName: string;
}

/**
 * Banner shown to any signed-in user who has pending agency team invites. Accepting joins
 * the agency workspace (the API adds the membership; a reload re-routes them via tenant-context).
 */
export const PendingInvites: React.FC = () => {
  const { data, refetch } = useCustom<{ data: PendingInvite[] }>({
    url: `${getApiBase()}/team/pending`,
    method: 'get',
    queryOptions: { staleTime: 30_000, retry: false },
  });
  const { mutateAsync } = useCustomMutation();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const invites = (data?.data as unknown as PendingInvite[]) ?? [];
  if (invites.length === 0) return null;

  const act = async (id: string, action: 'accept' | 'decline') => {
    setBusyId(id);
    try {
      await mutateAsync({ url: `${getApiBase()}/team/invites/${id}/${action}`, method: 'post', values: {} });
      if (action === 'accept') {
        // Re-route to the shared agency tenant on next request.
        window.location.reload();
        return;
      }
      await refetch();
    } catch {
      alert(action === 'accept' ? 'Could not accept — the invite email must match your verified address.' : 'Could not decline the invite.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
      {invites.map((inv) => (
        <div key={inv.id} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderRadius: 8,
          background: 'rgba(var(--accent-rgb),0.08)', border: '1px solid rgba(var(--accent-rgb),0.25)',
        }}>
          <Users size={18} style={{ color: 'var(--accent-500)', flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>
            <strong>{inv.tenantName}</strong> invited you to join their agency workspace as <strong>{inv.role}</strong>.
            <span style={{ color: 'var(--text-muted)' }}> Accepting shares their campaigns, sites, and analytics with you.</span>
          </div>
          <button
            onClick={() => void act(inv.id, 'accept')}
            disabled={busyId === inv.id}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
          >
            {busyId === inv.id ? <Loader2 size={13} className="spin" /> : <Check size={13} />} Accept
          </button>
          <button
            onClick={() => void act(inv.id, 'decline')}
            disabled={busyId === inv.id}
            className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
          >
            <X size={13} /> Decline
          </button>
        </div>
      ))}
    </div>
  );
};
