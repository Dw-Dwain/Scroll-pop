/**
 * ScrollPop Cloudflare Worker
 *
 * Routes:
 *   GET  /c/:publicKey  → Site config (cached in KV, 1h TTL + purge-on-publish)
 *   POST /e             → Event ingest (forwards to Redis stream)
 *
 * IMPORTANT: This worker is a thin edge layer only.
 * No business logic here — that lives in apps/api.
 */

import * as Sentry from '@sentry/cloudflare';
import snippetCode from './p.txt';
import { scrubSentryEvent } from './sentry-scrub';
import { configHasAdClose, stripAdCloseFromCampaigns } from './grey-hat';

export interface Env {
  SCROLLPOP_CONFIG?: KVNamespace;
  SNIPPET_BUCKET?: R2Bucket;
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

// Fallback Content-Type for /creatives/<name> when the R2 object has no stored
// httpMetadata.contentType (e.g. uploaded via a tool that doesn't set it). Without
// this, a .jpg upload would be served as `image/png` — browsers usually sniff and
// recover, but get the header right so it's correct regardless.
function creativeContentTypeFromName(name: string): string {
  const ext = name.toLowerCase().split('.').pop();
  switch (ext) {
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'png':
    default: return 'image/png';
  }
}

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN ?? '',
    tracesSampleRate: 0,
    // Japan APPI data-minimization — keep re-identifiable PII out of the event.
    // TODO(APPI/manual): the authoritative IP fix is the Sentry project toggle
    // "Prevent Storing of IP Addresses"; sendDefaultPii:false + beforeSend below are
    // defense-in-depth only (IP is attached server-side).
    sendDefaultPii: false,
    beforeSend: (event) => scrubSentryEvent(event),
  }),
{
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // GET …/<name>.js — core snippet (p.js) or any lazy chunk (spin.js, targeting.js, …),
    // served from R2. p.js falls back to the bundled copy if the R2 object is missing; lazy
    // chunks have no embedded fallback, so they MUST be uploaded to R2 by CI (see deploy-worker).
    // The flat allowlist (lowercase name, no slashes) blocks path traversal.
    const jsMatch = request.method === 'GET' ? /\/([a-z0-9_-]+)\.js$/.exec(url.pathname) : null;
    if (jsMatch) {
      const file = `${jsMatch[1]}.js`;
      const snippetHeaders = {
        'Content-Type': 'application/javascript',
        'X-Content-Type-Options': 'nosniff',
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=300',
      };
      if (env.SNIPPET_BUCKET) {
        const obj = await env.SNIPPET_BUCKET.get(file);
        if (obj) {
          return new Response(obj.body, { headers: snippetHeaders });
        }
      }
      if (file === 'p.js') return new Response(snippetCode, { headers: snippetHeaders });
      // Lazy chunk missing from R2 — surface a clear 404 instead of a silent empty body.
      return new Response(`/* ${file} not deployed */`, { status: 404, headers: snippetHeaders });
    }

    // GET /creatives — list available creative names (for the dashboard thumbnail picker).
    if (request.method === 'GET' && url.pathname === '/creatives') {
      let creatives: string[] = [];
      if (env.SNIPPET_BUCKET) {
        try {
          const listed = await env.SNIPPET_BUCKET.list({ prefix: 'creatives/' });
          creatives = listed.objects
            .map((o) => o.key.replace(/^creatives\//, ''))
            .filter((n) => n && /\.(png|jpe?g|webp|gif)$/i.test(n));
        } catch { /* non-fatal */ }
      }
      return new Response(JSON.stringify({ creatives }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, 'Cache-Control': 'public, max-age=60' },
      });
    }

    // GET /creatives/<name> — non-editable "ScrollPop Creatives" images served from R2.
    // Used by the blank image template (full-bleed creative + transparent CTA + X).
    if (request.method === 'GET' && url.pathname.startsWith('/creatives/')) {
      // Decode percent-encoding first (spaces arrive as %20), then sanitize to a flat allowlist
      // (no path traversal, no subfolders). Spaces are allowed — filenames may contain them.
      const rawName = decodeURIComponent(url.pathname.slice('/creatives/'.length));
      const name = rawName.replace(/[^a-zA-Z0-9._\- ]/g, '');
      if (name && env.SNIPPET_BUCKET) {
        const obj = await env.SNIPPET_BUCKET.get(`creatives/${name}`);
        if (obj) {
          return new Response(obj.body, {
            headers: {
              'Content-Type': obj.httpMetadata?.contentType || creativeContentTypeFromName(name),
              'X-Content-Type-Options': 'nosniff',
              ...CORS_HEADERS,
              'Cache-Control': 'public, max-age=86400',
            },
          });
        }
      }
      return new Response('Creative not found', { status: 404, headers: CORS_HEADERS });
    }

    // GET /scrollpop-wp.zip — the WordPress plugin bundle, served from R2 over our own production
    // domain (cdn.scrollpop.online) instead of the rate-limited *.r2.dev public bucket URL, which
    // Cloudflare documents as not-for-production (P3-3). Same R2 bucket binding the snippet/creatives
    // use. The `?v=` query is a cache-bust token only — the object key is fixed.
    if (request.method === 'GET' && url.pathname === '/scrollpop-wp.zip') {
      if (env.SNIPPET_BUCKET) {
        const obj = await env.SNIPPET_BUCKET.get('scrollpop-wp.zip');
        if (obj) {
          return new Response(obj.body, {
            headers: {
              'Content-Type': 'application/zip',
              'Content-Disposition': 'attachment; filename="scrollpop-wp.zip"',
              'X-Content-Type-Options': 'nosniff',
              ...CORS_HEADERS,
              'Cache-Control': 'public, max-age=300',
            },
          });
        }
      }
      return new Response('Plugin bundle not found', { status: 404, headers: CORS_HEADERS });
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
    //   502/503/5xx → origin (Fly.io API) down, redeploying, or erroring
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

  // Store in KV with 1h TTL (async — don't block response), if KV is bound.
  // Long TTL is safe: purgeSiteConfigCache() deletes this key immediately on
  // publish/pause/status change, so the TTL is just a backstop, not the
  // freshness mechanism. A short TTL just churns KV writes (free-tier limit
  // is 1,000/day — 3 actively-polled keys at 60s TTL alone burned ~870/day).
  if (env.SCROLLPOP_CONFIG) {
    ctx.waitUntil(
      env.SCROLLPOP_CONFIG.put(kvKey, configJson, { expirationTtl: 3600 })
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

  // 3. Grey-hat containment (the X-close → affiliate redirect, adClose). The origin already gates
  //    this at config assembly, but the edge re-enforces it per request so it's instant + can't be
  //    bypassed by a stale/forced KV config:
  //      • kill switch ON      → strip from EVERY served config (global panic button, no deploy).
  //      • config not Novatise → strip (defense-in-depth; greyHatAllowed is set true only for them).
  //    Only read the KV kill switch when there's actually an ad-close to kill AND it's allowed —
  //    keeps this off the hot path for the ~all configs that have neither.
  const remaining = c['campaigns'] as unknown[] | undefined;
  if (Array.isArray(remaining) && configHasAdClose(remaining)) {
    const kill = c['greyHatAllowed'] === true ? await readKillSwitch(env) : true;
    if (kill) stripAdCloseFromCampaigns(remaining);
  }

  // Strip internal-only fields — never expose to the browser.
  delete c['tenantId'];
  delete c['monthlyViewLimit'];
  delete c['greyHatAllowed'];

  return JSON.stringify(c);
}

// ─── Grey-hat (X-close redirect) edge containment ───────────────────────────────
// Global kill switch: set this KV key to any truthy value to strip the X-close affiliate
// redirect from EVERY served config instantly, with no deploy. Clear it (or set 0/false) to
// restore. Set via: `wrangler kv key put --binding=SCROLLPOP_CONFIG killswitch:adclose 1`
// (or the Cloudflare dashboard → Workers KV). This is the "audit landed / policy changed" button.
const GREY_HAT_KILL_SWITCH_KEY = 'killswitch:adclose';

async function readKillSwitch(env: Env): Promise<boolean> {
  // FAIL CLOSED. For the allowed (Novatise) path the origin does NOT strip the X-close redirect —
  // this kill switch is the ONLY off-ramp — so if we can't confirm its state we must assume it's ON
  // and strip, rather than ship a ToS-grey-area redirect we can't verify is still permitted. The
  // happy path (KV bound, key unset) still returns false below, so normal serving is unchanged;
  // only KV-unbound / read-error degrade to stripping. Briefly under-serving the redirect during a
  // KV blip is the safe direction for a compliance panic button.
  if (!env.SCROLLPOP_CONFIG) return true;
  try {
    const v = (await env.SCROLLPOP_CONFIG.get(GREY_HAT_KILL_SWITCH_KEY, 'text'))?.trim().toLowerCase();
    return !!v && v !== '' && v !== '0' && v !== 'false' && v !== 'off';
  } catch {
    return true; // fail CLOSED on a KV error — strip when the switch can't be read
  }
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
  // batch. Each attempt has its own 10s timeout (the Fly API is always-warm, but a redeploy can
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
