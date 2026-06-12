import type { DataProvider, BaseRecord } from '@refinedev/core';

// Extract method param types directly from the DataProvider interface so we stay in sync
// with Refine's API without importing their internal param-type names (which vary across versions).
type GetListP   = Parameters<DataProvider['getList']>[0];
type GetOneP    = Parameters<DataProvider['getOne']>[0];
type CreateP    = Parameters<DataProvider['create']>[0];
type UpdateP    = Parameters<DataProvider['update']>[0];
type DeleteP    = Parameters<DataProvider['deleteOne']>[0];
type CustomP    = Parameters<NonNullable<DataProvider['custom']>>[0];

// The live API. Hard-coded as a safety net because a stale Cloudflare Pages env var can bake the
// decommissioned Render URL into the build (which the CSP also blocks → dashboard shows nothing).
const PROD_API = 'https://scrollpop-api.fly.dev';

export function getApiBase(): string {
  // VITE_API_URL is set at build time for the web dashboard.
  let configured = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
  // Never call the dead Render origin: if a stale build still points at onrender.com, override it.
  if (configured && /onrender\.com/i.test(configured)) configured = PROD_API;
  // If VITE_API_URL is missing on a deployed scrollpop.online host, fall back to the live API
  // (not a relative path, which would 404 against the static Pages host).
  else if (!configured && typeof window !== 'undefined' && /(^|\.)scrollpop\.online$/i.test(window.location.hostname)) {
    configured = PROD_API;
  }
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
// authenticated requests (using the Clerk token) without needing useAuth().
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
  // Default JSON content-type when sending a body so Fastify parses it (callers pass
  // JSON.stringify(...)). Only when a body is present — avoids FST_ERR_CTP_EMPTY_JSON_BODY on
  // bodyless POST/DELETE. Without this, the API receives a raw string and z.object().parse 400s.
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
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
    getList: async <TData extends BaseRecord = BaseRecord>({ resource, pagination }: GetListP) => {
      const API_BASE = getApiBase();
      const base = API_BASE.startsWith('http') ? '' : window.location.origin;
      const url = new URL(`${base}${API_BASE}/${resource}`);

      if (pagination?.current) {
        url.searchParams.append('page', pagination.current.toString());
      }
      if (pagination?.pageSize) {
        url.searchParams.append('limit', pagination.pageSize.toString());
      }

      // Agency client scoping: when a client workspace is active, scope the client-aware list
      // resources to it (the API filters via the site→campaign chain). Empty/absent = no filter.
      if (resource === 'campaigns' || resource === 'leads') {
        try {
          const activeClient = localStorage.getItem('sp_active_client');
          if (activeClient) url.searchParams.append('clientId', activeClient);
        } catch { /* localStorage unavailable — skip scoping */ }
      }

      const res = await fetchWithAuth(url.toString());
      if (res.status === 401) return { data: [] as TData[], total: 0 };
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const body = await res.json() as { data: TData[]; meta?: { total?: number } };

      return {
        data: body.data,
        total: body.meta?.total ?? body.data.length,
      };
    },

    getOne: async <TData extends BaseRecord = BaseRecord>({ resource, id }: GetOneP) => {
      const API_BASE = getApiBase();
      const res = await fetchWithAuth(`${API_BASE}/${resource}/${id}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const body = await res.json() as { data: TData };
      return { data: body.data };
    },

    create: async <TData extends BaseRecord = BaseRecord>({ resource, variables }: CreateP) => {
      const API_BASE = getApiBase();
      const res = await fetchWithAuth(`${API_BASE}/${resource}`, {
        method: 'POST',
        body: JSON.stringify(variables),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const body = await res.json() as { data: TData };
      return { data: body.data };
    },

    update: async <TData extends BaseRecord = BaseRecord>({ resource, id, variables }: UpdateP) => {
      const API_BASE = getApiBase();
      const url = id ? `${API_BASE}/${resource}/${id}` : `${API_BASE}/${resource}`;
      const res = await fetchWithAuth(url, {
        method: 'PATCH',
        body: JSON.stringify(variables),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const body = await res.json() as { data: TData };
      return { data: body.data };
    },

    deleteOne: async <TData extends BaseRecord = BaseRecord>({ resource, id }: DeleteP) => {
      const API_BASE = getApiBase();
      const url = id ? `${API_BASE}/${resource}/${id}` : `${API_BASE}/${resource}`;
      const res = await fetchWithAuth(url, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      try {
        const body = await res.json() as { data: TData };
        return { data: body.data };
      } catch {
        return { data: { id } as TData };
      }
    },

    custom: async <TData extends BaseRecord = BaseRecord>({ url, method, payload }: CustomP) => {
      const API_BASE = getApiBase();
      const resolvedUrl = resolveUrl(API_BASE, url);
      const options: RequestInit = { method: (method as string).toUpperCase() };
      if (payload) options.body = JSON.stringify(payload);
      const res = await fetchWithAuth(resolvedUrl, options);
      if (res.status === 401) return { data: null as unknown as TData };
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const body = await res.json() as { data: TData };
      return { data: (body.data ?? body) as TData };
    },

    getApiUrl: () => getApiBase(),
  };
};
