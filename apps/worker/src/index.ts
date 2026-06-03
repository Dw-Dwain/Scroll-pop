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

import * as Sentry from '@sentry/cloudflare';
import snippetCode from './p.txt';

export interface Env {
  // Optional: when no KV namespace is bound, config is served uncached from origin.
  SCROLLPOP_CONFIG?: KVNamespace;
  API_ORIGIN: string;
  REDIS_URL: string;
  REDIS_TOKEN: string;
  INTERNAL_SECRET: string;
  SENTRY_DSN?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN ?? '',
    tracesSampleRate: 0,
  }),
{
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
          'X-Content-Type-Options': 'nosniff',
          ...CORS_HEADERS,
          'Cache-Control': 'public, max-age=300'
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
});

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

  const kvKey = `config:v2:${publicKey}`;

  // Try KV cache first (only when a KV namespace is bound)
  if (env.SCROLLPOP_CONFIG) {
    const cached = await env.SCROLLPOP_CONFIG.get(kvKey, 'text');
    if (cached) {
      return new Response(await augmentConfig(cached, request, env), {
        headers: {
          'Content-Type': 'application/json',
          // private: the body is augmented per-request with the visitor's country +
          // live view-cap enforcement, so it must not be shared-cached across visitors.
          'Cache-Control': 'private, max-age=60',
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
    const upstream = originResponse.status;
    // Surface the REAL upstream cause instead of a misleading generic "Site not found":
    //   401 → INTERNAL_SECRET mismatch between this Worker and the API
    //   404 → site/public key genuinely not found
    //   502/503/5xx → origin (Render) down, redeploying, or erroring
    let reason = 'Config temporarily unavailable';
    if (upstream === 404) reason = 'Site not found';
    else if (upstream === 401) reason = 'Worker/API INTERNAL_SECRET mismatch';
    console.error(`[config] origin ${upstream} for ${publicKey}: ${reason}`);
    return new Response(JSON.stringify({ error: reason, upstreamStatus: upstream }), {
      status: upstream === 404 ? 404 : 502,
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

  return new Response(await augmentConfig(configJson, request, env), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=60',
      'X-Cache': 'MISS',
      ...CORS_HEADERS,
    },
  });
}

/**
 * Per-request augmentation of the config payload (done AFTER the KV read so the shared
 * cache stays generic). Two jobs in one JSON round-trip:
 *  1. Inject the visitor's country (CF-IPCountry) for geo targeting.
 *  2. Enforce the monthly view cap in REAL TIME against the live Redis counter — this
 *     closes the up-to-60s overage window where a KV-cached config would keep serving
 *     popups after a tenant crossed its limit mid-cache. Fail OPEN on any error.
 * The internal tenantId / monthlyViewLimit fields are STRIPPED before returning so they
 * never reach the browser.
 */
async function augmentConfig(configJson: string, request: Request, env: Env): Promise<string> {
  let c: Record<string, unknown>;
  try { c = JSON.parse(configJson); } catch { return configJson; }

  // 1. Geo
  const country =
    ((request as { cf?: { country?: string } }).cf?.country) ||
    request.headers.get('CF-IPCountry') ||
    '';
  if (country && country !== 'XX' && country !== 'T1') c.geo = { country };

  // 2. Real-time view-cap enforcement
  const tenantId = c['tenantId'] as string | undefined;
  const limit = c['monthlyViewLimit'] as number | undefined;
  const campaigns = c['campaigns'] as unknown[] | undefined;
  if (tenantId && typeof limit === 'number' && limit > 0 && Array.isArray(campaigns) && campaigns.length > 0) {
    const used = await readMonthlyViews(env, tenantId);
    if (used !== null && used >= limit) {
      c['campaigns'] = [];
      c['limitExceeded'] = true;
    }
  }
  // Strip internal-only fields — never expose to the browser.
  delete c['tenantId'];
  delete c['monthlyViewLimit'];

  return JSON.stringify(c);
}

/**
 * Read this tenant's current-month impression count from the Upstash Redis REST API.
 * Returns null on any failure (missing creds, network error) so the caller fails OPEN.
 */
async function readMonthlyViews(env: Env, tenantId: string): Promise<number | null> {
  if (!env.REDIS_URL || !env.REDIS_TOKEN) return null;
  const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  try {
    const res = await fetch(`${env.REDIS_URL}/get/sp_views:${tenantId}:${month}`, {
      headers: { Authorization: `Bearer ${env.REDIS_TOKEN}` },
    });
    if (!res.ok) return null;
    const body = await res.json() as { result?: string | null };
    return body.result != null ? (parseInt(body.result, 10) || 0) : 0;
  } catch {
    return null;
  }
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
  // Phase 2: richer analytics fields
  scrollDepthPct?: number;
  trafficSource?: string;
  abVariantId?: string;
  shopifyOrderId?: string;
  revenueCents?: number;
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

  // Forward events to production Fastify backend for real-time DB persistence.
  // Pass the real visitor IP so the API can apply per-client rate limiting + abuse gating;
  // the INTERNAL_SECRET header proves the IP came from us (the API won't trust it otherwise).
  const clientIp = request.headers.get('CF-Connecting-IP') ?? '';
  ctx.waitUntil(forwardEventsToApi(env, enrichedEvents, clientIp));

  return new Response(JSON.stringify({ received: enrichedEvents.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function forwardEventsToApi(env: Env, events: unknown[], clientIp: string): Promise<void> {
  if (!env.API_ORIGIN) {
    console.warn('API_ORIGIN not configured — events cannot be forwarded');
    return;
  }

  const url = `${env.API_ORIGIN}/e`;
  const body = JSON.stringify({ events });
  // One retry: a transient origin blip (brief 5xx / network reset) shouldn't silently lose a
  // batch. Each attempt has its own 10s timeout (Render is always-warm now, but a redeploy can
  // still blip). 2 attempts max keeps the Worker's waitUntil budget bounded.
  const MAX_ATTEMPTS = 2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': env.INTERNAL_SECRET,
          'X-CF-Connecting-IP': clientIp,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.ok) return;
      // 4xx is a permanent client error (bad payload, rate limited) — retrying won't help.
      if (response.status < 500) {
        console.error('API event forwarding rejected (no retry):', response.status);
        return;
      }
      console.warn(`API event forwarding got ${response.status} (attempt ${attempt}/${MAX_ATTEMPTS})`);
    } catch (err: unknown) {
      clearTimeout(timeout);
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Event forwarding error on attempt ${attempt}/${MAX_ATTEMPTS}: ${msg}`);
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 500)); // brief backoff before the retry
    } else {
      console.error('Event forwarding failed after retries — batch lost.');
    }
  }
}
