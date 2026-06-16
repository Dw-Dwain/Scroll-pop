import { describe, it, expect } from 'vitest';
import { scrubSentryEvent, stripUrlQuery } from './sentry.js';

describe('stripUrlQuery', () => {
  it('removes the query string but keeps scheme/host/path', () => {
    expect(stripUrlQuery('https://api.scrollpop.io/v1/x?token=secret&id=42')).toBe(
      'https://api.scrollpop.io/v1/x',
    );
  });

  it('passes through URLs without a query', () => {
    expect(stripUrlQuery('https://api.scrollpop.io/v1/x')).toBe('https://api.scrollpop.io/v1/x');
  });

  it('ignores non-string values', () => {
    expect(stripUrlQuery(undefined)).toBeUndefined();
    expect(stripUrlQuery(42)).toBe(42);
  });
});

describe('scrubSentryEvent (API)', () => {
  it('deletes user, cookies and query_string, and strips query strings from URLs', () => {
    const event = {
      user: { id: 'u1', ip_address: '1.2.3.4' },
      request: {
        url: 'https://api.scrollpop.io/v1/campaigns?token=secret',
        cookies: 'session=abc',
        query_string: 'token=secret',
      },
      extra: { url: 'https://api.scrollpop.io/v1/campaigns?token=secret', stack: 'at foo()' },
    };

    const out = scrubSentryEvent(event);

    expect(out.user).toBeUndefined();
    expect(out.request.cookies).toBeUndefined();
    expect(out.request.query_string).toBeUndefined();
    expect(out.request.url).toBe('https://api.scrollpop.io/v1/campaigns');
    // The real backend PII path: error-handler attaches `extra.url = request.url`.
    expect(out.extra.url).toBe('https://api.scrollpop.io/v1/campaigns');
    // Non-PII context is preserved — we minimize, we don't drop the event.
    expect(out.extra.stack).toBe('at foo()');
  });
});
