import { describe, it, expect } from 'vitest';
import { scrubSentryEvent, stripUrlQuery, type SentryEventLike } from './sentry-scrub';

describe('stripUrlQuery', () => {
  it('strips query strings', () => {
    expect(stripUrlQuery('https://site.jp/p?utm=foo&pii=bar')).toBe('https://site.jp/p');
  });

  it('passes through non-strings and query-less URLs', () => {
    expect(stripUrlQuery(null)).toBeNull();
    expect(stripUrlQuery('https://site.jp/p')).toBe('https://site.jp/p');
  });
});

describe('scrubSentryEvent (worker)', () => {
  it('removes PII and strips URLs in request + navigation breadcrumbs', () => {
    const event: SentryEventLike = {
      user: { id: 'visitor-1' },
      request: {
        url: 'https://site.jp/checkout?email=a@b.com',
        cookies: { sid: 'abc' },
        query_string: 'email=a@b.com',
      },
      breadcrumbs: [
        { data: { from: '/cart?u=1', to: '/checkout?email=a@b.com' } },
        { data: { url: '/keep-me' } },
      ],
    };

    scrubSentryEvent(event);

    expect(event.user).toBeUndefined();
    expect(event.request!.cookies).toBeUndefined();
    expect(event.request!.query_string).toBeUndefined();
    expect(event.request!.url).toBe('https://site.jp/checkout');

    const nav = event.breadcrumbs![0]!;
    expect(nav.data!['from']).toBe('/cart');
    expect(nav.data!['to']).toBe('/checkout');
    // Unrelated breadcrumb data is left untouched.
    const other = event.breadcrumbs![1]!;
    expect(other.data!['url']).toBe('/keep-me');
  });
});
