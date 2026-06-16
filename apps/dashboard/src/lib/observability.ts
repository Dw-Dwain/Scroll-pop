/**
 * Dependency-free observability bootstrap for the dashboard.
 *
 * Both PostHog and Sentry are loaded from their CDNs and configured from Vite env vars,
 * so there's no npm dependency (avoids the pnpm v11 build-script block that removed
 * posthog-js) and nothing runs until you set the keys. `VITE_*` vars are baked at build
 * time — after setting them in Cloudflare Pages you must redeploy.
 *
 *   VITE_POSTHOG_KEY   product analytics (e.g. phc_...)
 *   VITE_POSTHOG_HOST  optional, defaults to https://us.i.posthog.com (use https://eu.i.posthog.com for EU)
 *   VITE_SENTRY_DSN    front-end error tracking (https://<key>@<org>.ingest.sentry.io/<project>)
 */

declare global {
  interface Window {
    posthog?: { _i?: unknown[][];[k: string]: unknown };
    sentryOnLoad?: () => void;
    Sentry?: { init?: (opts: Record<string, unknown>) => void };
  }
}

/* ------------------------------------------------------------------------- *
 * Privacy scrubbers — Japan APPI data-minimization (defense-in-depth).
 *
 * These strip re-identifiable personal data from telemetry payloads before
 * they leave the browser. They DO NOT change event names, counts or product
 * behavior — only the PII fields are neutralized. Exported so they can be
 * unit-tested in isolation (see observability.test.ts).
 * ------------------------------------------------------------------------- */

/** Drop the query string (everything from the first `?`) from a URL-ish string. */
export function stripUrlQuery(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const i = value.indexOf('?');
  return i === -1 ? value : value.slice(0, i);
}

interface PostHogEventLike {
  properties?: Record<string, unknown>;
}

/**
 * PostHog `before_send`: strip query strings from `$current_url`/`$referrer`
 * and drop `$ip`. Returns the (mutated) event so the capture still happens —
 * returning `null` would discard the event, which we never want here.
 */
export function posthogBeforeSend(
  event: PostHogEventLike | null,
): PostHogEventLike | null {
  if (!event) return event;
  const p = event.properties;
  if (p && typeof p === 'object') {
    if ('$current_url' in p) p['$current_url'] = stripUrlQuery(p['$current_url']);
    if ('$referrer' in p) p['$referrer'] = stripUrlQuery(p['$referrer']);
    delete p['$ip'];
  }
  return event;
}

interface SentryEventLike {
  user?: unknown;
  request?: { url?: unknown; cookies?: unknown; query_string?: unknown };
  breadcrumbs?: Array<{ data?: Record<string, unknown> } | null>;
}

/**
 * Sentry `beforeSend`: delete `user`, the request cookies and query string, and
 * strip query strings from the request URL and navigation breadcrumbs
 * (`b.data.to` / `b.data.from`). Mutates and returns the event.
 */
export function sentryBeforeSend<T extends SentryEventLike>(event: T): T {
  delete event.user;
  const req = event.request;
  if (req && typeof req === 'object') {
    delete req.cookies;
    delete req.query_string;
    if (typeof req.url === 'string') req.url = stripUrlQuery(req.url);
  }
  if (Array.isArray(event.breadcrumbs)) {
    for (const b of event.breadcrumbs) {
      const d = b?.data;
      if (d && typeof d === 'object') {
        if ('to' in d) d['to'] = stripUrlQuery(d['to']);
        if ('from' in d) d['from'] = stripUrlQuery(d['from']);
      }
    }
  }
  return event;
}

function initPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) return;
  const apiHost = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';
  const assetHost = apiHost.replace('.i.posthog.com', '-assets.i.posthog.com');

  // Mirror the official loader: queue an init on `_i`, then load array.js, which drains the
  // queue and replaces window.posthog with the real SDK. No method-stub transcription needed.
  window.posthog = window.posthog || {};
  window.posthog._i = window.posthog._i || [];
  // TODO(APPI/manual): the authoritative IP fix is the PostHog project toggle
  // "Discard client IP data". Deleting $ip in before_send below is defense-in-depth
  // only — PostHog also derives the IP server-side from the request, which ONLY that
  // dashboard toggle removes. This cannot be done in code.
  window.posthog._i.push([key, {
    api_host: apiHost,
    person_profiles: 'identified_only',
    capture_pageview: true,
    persistence: 'memory', // no persistent stored visitor ID — distinct_id is session-only
    before_send: posthogBeforeSend,
    // Defensive: if session replay is enabled in PostHog project settings, mask all
    // input values and text so recordings never capture PII.
    session_recording: { maskAllInputs: true, maskTextSelector: '*' },
  }, 'posthog']);

  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `${assetHost}/static/array.js`;
  document.head.appendChild(s);
}

function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  // The Loader script URL embeds the DSN's public key (the part before '@').
  const publicKey = /^https?:\/\/([^@]+)@/.exec(dsn)?.[1];
  if (!publicKey) return;

  // The loader calls window.sentryOnLoad (if defined) before initializing, so we set our
  // config here. tracesSampleRate:0 keeps us on the free error-only tier (no perf quota burn).
  window.sentryOnLoad = () => {
    // TODO(APPI/manual): the authoritative IP fix is the Sentry project toggle
    // "Prevent Storing of IP Addresses". sendDefaultPii:false + the beforeSend below
    // are defense-in-depth — Sentry attaches the client IP server-side, which ONLY that
    // dashboard toggle removes. This cannot be done in code.
    window.Sentry?.init?.({
      dsn,
      environment: import.meta.env.MODE,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      // Session replay stays disabled (both rates 0), so no replay input/text masking
      // is needed here. If replay is ever enabled, add maskAllInputs + maskAllText.
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      beforeSend: sentryBeforeSend,
    });
  };

  const s = document.createElement('script');
  s.src = `https://js.sentry-cdn.com/${publicKey}.min.js`;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
}

/** Initialize analytics + error tracking. Safe to call once at startup; no-ops without keys. */
export function initObservability(): void {
  try { initPostHog(); } catch { /* analytics must never break the app */ }
  try { initSentry(); } catch { /* error tracking must never break the app */ }
}
