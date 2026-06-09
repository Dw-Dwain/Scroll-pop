import React from 'react';
import { useCustom } from '@refinedev/core';
import { getApiBase } from '../providers/dataProvider';
import { usePlan } from './usePlan';

export interface ClientWorkspace {
  id: string;
  name: string;
  siteCount: number;
  createdAt?: string;
}

const ACTIVE_KEY = 'sp_active_client';
const CHANGE_EVENT = 'sp:active-client';

/** Read the persisted active-client id (empty string = "All clients"). */
function readActiveClient(): string {
  try { return localStorage.getItem(ACTIVE_KEY) ?? ''; } catch { return ''; }
}

/**
 * Active-client selection, shared across the app. Persists to localStorage and
 * broadcasts a same-tab custom event (the native `storage` event only fires in
 * *other* tabs) so every consumer re-renders on switch.
 */
export function useActiveClient() {
  const [activeClientId, setId] = React.useState<string>(readActiveClient);

  React.useEffect(() => {
    const sync = () => setId(readActiveClient());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setActiveClient = React.useCallback((id: string) => {
    try {
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch { /* ignore */ }
    setId(id);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { activeClientId, setActiveClient };
}

/**
 * The agency's client workspaces. Returns [] for non-agency tenants (the API
 * also guards this, but we skip the request entirely when not on the agency plan).
 */
export function useClients(): {
  clients: ClientWorkspace[];
  isAgency: boolean;
  isLoading: boolean;
  refetch: () => void;
} {
  const { plan, isUnlimited } = usePlan();
  const isAgency = plan === 'agency' || isUnlimited;

  const { data, isLoading, refetch } = useCustom<{ data: ClientWorkspace[] }>({
    url: `${getApiBase()}/clients`,
    method: 'get',
    queryOptions: { enabled: isAgency, staleTime: 30_000, retry: false },
  });

  // dataProvider.custom unwraps the envelope, so `data.data` is the array.
  const clients = (data?.data as unknown as ClientWorkspace[]) ?? [];
  return { clients, isAgency, isLoading, refetch };
}
