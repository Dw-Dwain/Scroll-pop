/**
 * Sentry event scrubbing — Japan APPI data-minimization (defense-in-depth).
 *
 * Strips re-identifiable personal data from the event before it leaves the edge.
 * Kept in its own module (no `@sentry/cloudflare` or `p.txt` imports) so it can be
 * unit-tested in plain Node without the Worker runtime. Does NOT change event names,
 * counts or behavior — only the PII fields are neutralized.
 *
 * TODO(APPI/manual): the authoritative IP fix is the Sentry project toggle
 * "Prevent Storing of IP Addresses" — the client IP is attached server-side and ONLY
 * that dashboard toggle removes it. This module is defense-in-depth only.
 */

/** Drop the query string (everything from the first `?`) from a URL-ish string. */
export function stripUrlQuery(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const i = value.indexOf('?');
  return i === -1 ? value : value.slice(0, i);
}

export interface SentryEventLike {
  user?: unknown;
  request?: { url?: unknown; cookies?: unknown; query_string?: unknown };
  breadcrumbs?: Array<{ data?: Record<string, unknown> } | null>;
}

/**
 * Delete `user`, the request cookies and query string, and strip query strings from
 * the request URL and navigation breadcrumbs (`b.data.to` / `b.data.from`). Mutates
 * and returns the event (returning null would drop it — we minimize, never discard).
 */
export function scrubSentryEvent<T extends SentryEventLike>(event: T): T {
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
