import type { DataProvider, BaseRecord } from '@refinedev/core';

declare global {
  interface Window {
    electronAPI?: {
      isDesktop: boolean;
      getLocalApiUrl: () => string;
      getVersion: () => Promise<string>;
      checkForUpdates: () => Promise<void>;
      onUpdateAvailable: (cb: (info: unknown) => void) => void;
      onUpdateDownloaded: (cb: (info: unknown) => void) => void;
      installUpdate: () => Promise<void>;
    };
  }
}

export function getApiBase(): string {
  if (typeof window !== 'undefined' && window.electronAPI?.isDesktop) {
    return `${window.electronAPI.getLocalApiUrl()}/api/v1`;
  }
  // VITE_API_URL is set at build time for the web dashboard (e.g. https://api.scrollpop.online)
  const configured = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
  return configured ? `${configured}/api/v1` : '/api/v1';
}

function resolveUrl(apiBase: string, relativePath: string): string {
  if (relativePath.startsWith('http')) return relativePath;
  const origin = apiBase.startsWith('http')
    ? apiBase.replace(/\/api\/v1$/, '')
    : window.location.origin;
  return `${origin}${relativePath}`;
}

// Holds the active token getter so non-Refine code (e.g. authed file downloads) can make
// authenticated requests in any auth mode (Clerk / demo / desktop) without needing useAuth().
let activeGetToken: () => Promise<string | null> = async () => null;

/**
 * Authenticated fetch for raw (non-JSON) endpoints like file downloads. `path` is relative
 * to the API base (e.g. "/campaigns/<id>/export"). Uses whatever token the active data
 * provider was created with.
 */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await activeGetToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const apiBase = getApiBase();
  const url = path.startsWith('http')
    ? path
    : `${apiBase.startsWith('http') ? apiBase : `${window.location.origin}${apiBase}`}${path}`;
  return fetch(url, { ...init, headers });
}

export const createDataProvider = (getToken: () => Promise<string | null>): DataProvider => {
  activeGetToken = getToken;
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    const headers = new Headers(options.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    // Only set Content-Type if a body is present (prevents FST_ERR_CTP_EMPTY_JSON_BODY under Fastify 5 for DELETE requests)
    if (options.body) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, { ...options, headers });
  };

  return {
    getList: async <TData extends BaseRecord = BaseRecord>({ resource, pagination }: any): Promise<any> => {
      const API_BASE = getApiBase();
      const base = API_BASE.startsWith('http') ? '' : window.location.origin;
      const url = new URL(`${base}${API_BASE}/${resource}`);
      
      if (pagination?.current) {
        url.searchParams.append('page', pagination.current.toString());
      }
      if (pagination?.pageSize) {
        url.searchParams.append('limit', pagination.pageSize.toString());
      }

      const res = await fetchWithAuth(url.toString());
      if (res.status === 401) return { data: [], total: 0 };
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const body = await res.json() as { data: unknown[]; meta?: { total?: number } };

      return {
        data: body.data as any[],
        total: body.meta?.total ?? body.data.length,
      };
    },

    getOne: async <TData extends BaseRecord = BaseRecord>({ resource, id }: any): Promise<any> => {
      const API_BASE = getApiBase();
      const res = await fetchWithAuth(`${API_BASE}/${resource}/${id}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const body = await res.json() as { data: unknown };
      return { data: body.data as any };
    },

    create: async <TData extends BaseRecord = BaseRecord, TVariables = {}>({ resource, variables }: any): Promise<any> => {
      const API_BASE = getApiBase();
      const res = await fetchWithAuth(`${API_BASE}/${resource}`, {
        method: 'POST',
        body: JSON.stringify(variables),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const body = await res.json() as { data: unknown };
      return { data: body.data as any };
    },

    update: async <TData extends BaseRecord = BaseRecord, TVariables = {}>({ resource, id, variables }: any): Promise<any> => {
      const API_BASE = getApiBase();
      const url = id ? `${API_BASE}/${resource}/${id}` : `${API_BASE}/${resource}`;
      const res = await fetchWithAuth(url, {
        method: 'PATCH',
        body: JSON.stringify(variables),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const body = await res.json() as { data: unknown };
      return { data: body.data as any };
    },

    deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = {}>({ resource, id }: any): Promise<any> => {
      const API_BASE = getApiBase();
      const url = id ? `${API_BASE}/${resource}/${id}` : `${API_BASE}/${resource}`;
      const res = await fetchWithAuth(url, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      try {
        const body = await res.json() as { data: { id: string } };
        return { data: body.data as any };
      } catch {
        return { data: { id } as any };
      }
    },

    custom: async ({ url, method, payload }: any): Promise<any> => {
      const API_BASE = getApiBase();
      const resolvedUrl = resolveUrl(API_BASE, url);
      const options: RequestInit = { method: (method as string).toUpperCase() };
      if (payload) options.body = JSON.stringify(payload);
      const res = await fetchWithAuth(resolvedUrl, options);
      if (res.status === 401) return { data: null };
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const body = await res.json();
      return { data: body.data ?? body };
    },

    getApiUrl: () => getApiBase(),
  };
};
