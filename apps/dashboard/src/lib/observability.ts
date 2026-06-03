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

function initPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) return;
  const apiHost = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';
  const assetHost = apiHost.replace('.i.posthog.com', '-assets.i.posthog.com');

  // Mirror the official loader: queue an init on `_i`, then load array.js, which drains the
  // queue and replaces window.posthog with the real SDK. No method-stub transcription needed.
  window.posthog = window.posthog || {};
  window.posthog._i = window.posthog._i || [];
  window.posthog._i.push([key, { api_host: apiHost, person_profiles: 'identified_only', capture_pageview: true }, 'posthog']);

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
    window.Sentry?.init?.({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
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
