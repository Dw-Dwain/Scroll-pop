/**
 * ScrollPop Cloudflare Worker
 *
 * Routes:
 *   GET  /c/:publicKey  → Site config (cached in KV, 60s TTL)
 *   POST /e             → Event ingest (forwards to Redis stream)
 *
 * IMPORTANT: This worker is a thin edge layer only.
 * No business logic here — that lives in apps/api.
 */

import snippetCode from './p.txt';

export interface Env {
  // Optional: when no KV namespace is bound, config is served uncached from origin.
  SCROLLPOP_CONFIG?: KVNamespace;
  API_ORIGIN: string;
  REDIS_URL: string;
  REDIS_TOKEN: string;
  INTERNAL_SECRET: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // GET /v1/:publicKey/p.js — serve the snippet
    if (request.method === 'GET' && url.pathname.endsWith('/p.js')) {
      return new Response(snippetCode, {
        headers: {
          'Content-Type': 'application/javascript',
          ...CORS_HEADERS,
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // GET /c/:publicKey — config endpoint
    if (request.method === 'GET' && url.pathname.startsWith('/c/')) {
      return handleConfig(request, env, ctx, url);
    }

    // POST /e — event ingest
    if (request.method === 'POST' && url.pathname === '/e') {
      return handleIngest(request, env, ctx);
    }

    return new Response('Not Found', { status: 404 });
  },
};

// ─── Config Handler ───────────────────────────────────────────────────────────

async function handleConfig(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL
): Promise<Response> {
  const publicKey = url.pathname.replace('/c/', '').split('/')[0];

  if (!publicKey || publicKey.length < 8) {
    return new Response(JSON.stringify({ error: 'Invalid public key' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const kvKey = `config:${publicKey}`;

  // Try KV cache first (only when a KV namespace is bound)
  if (env.SCROLLPOP_CONFIG) {
    const cached = await env.SCROLLPOP_CONFIG.get(kvKey, 'text');
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60',
          'X-Cache': 'HIT',
          ...CORS_HEADERS,
        },
      });
    }
  }

  // Cache miss — fetch from origin API
  const originUrl = `${env.API_ORIGIN}/api/v1/internal/config/${publicKey}`;
  let originResponse: Response;

  try {
    originResponse = await fetch(originUrl, {
      headers: {
        'X-Internal-Secret': env.INTERNAL_SECRET,
        'X-CF-Connecting-IP': request.headers.get('CF-Connecting-IP') ?? '',
      },
      cf: { cacheTtl: 0 }, // Don't use Cloudflare cache for origin calls
    });
  } catch (err) {
    console.error('Origin fetch error:', err);
    return new Response(JSON.stringify({ error: 'Config unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  if (!originResponse.ok) {
    const status = originResponse.status === 404 ? 404 : 502;
    return new Response(JSON.stringify({ error: 'Site not found' }), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const configJson = await originResponse.text();

  // Store in KV with 60s TTL (async — don't block response), if KV is bound
  if (env.SCROLLPOP_CONFIG) {
    ctx.waitUntil(
      env.SCROLLPOP_CONFIG.put(kvKey, configJson, { expirationTtl: 60 })
    );
  }

  return new Response(configJson, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      'X-Cache': 'MISS',
      ...CORS_HEADERS,
    },
  });
}

// ─── Event Ingest Handler ─────────────────────────────────────────────────────

interface RawEvent {
  tenantId?: string;
  siteId?: string;
  campaignId?: string;
  eventType?: string;
  affiliateSlotId?: string;
  visitorId?: string;
  sessionId?: string;
  device?: string;
  pageUrl?: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
}

async function handleIngest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  let body: { events?: RawEvent[] };

  try {
    body = await request.json() as { events?: RawEvent[] };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const events = body.events;
  if (!Array.isArray(events) || events.length === 0) {
    return new Response(JSON.stringify({ error: 'No events provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  if (events.length > 50) {
    return new Response(JSON.stringify({ error: 'Max 50 events per request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  // Enrich with Cloudflare metadata (injected here at the edge)
  const cf = (request as Request & { cf?: Record<string, string> }).cf;
  const enrichedEvents = events.map((event) => ({
    ...event,
    ts: new Date().toISOString(),
    country: cf?.['country'] ?? null,
    colo: cf?.['colo'] ?? null,
  }));

  // Forward events to production Fastify backend for real-time DB persistence
  ctx.waitUntil(forwardEventsToApi(env, enrichedEvents));

  return new Response(JSON.stringify({ received: enrichedEvents.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function forwardEventsToApi(env: Env, events: unknown[]): Promise<void> {
  if (!env.API_ORIGIN) {
    console.warn('API_ORIGIN not configured — events cannot be forwarded');
    return;
  }

  // 10s timeout prevents silent hangs when the API origin is cold-starting (Render free tier
  // can take 10-30s on first request — without a timeout the Worker execution context hangs,
  // events are dropped, and analytics never populate).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const url = `${env.API_ORIGIN}/e`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      console.error('API event forwarding returned non-ok status:', response.status);
    }
  } catch (err: unknown) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('aborted')) {
      console.warn('Event forwarding timed out — API cold start? Events lost for this batch.');
    } else {
      console.error('Error forwarding events to API:', err);
    }
  }
}
