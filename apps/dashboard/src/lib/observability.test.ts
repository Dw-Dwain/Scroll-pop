import { describe, it, expect } from 'vitest';
import { posthogBeforeSend, sentryBeforeSend, stripUrlQuery } from './observability';

describe('stripUrlQuery', () => {
  it('removes the query string but keeps the path', () => {
    expect(stripUrlQuery('https://app.scrollpop.io/dash?token=secret')).toBe(
      'https://app.scrollpop.io/dash',
    );
  });

  it('ignores non-strings', () => {
    expect(stripUrlQuery(undefined)).toBeUndefined();
  });
});

describe('posthogBeforeSend', () => {
  it('strips $current_url/$referrer query strings and deletes $ip', () => {
    const event = {
      properties: {
        $current_url: 'https://app.scrollpop.io/c/42?utm_source=x&email=a@b.com',
        $referrer: 'https://google.com/search?q=secret',
        $ip: '203.0.113.7',
        custom_prop: 'keep-me',
      },
    };

    const out = posthogBeforeSend(event);

    expect(out).not.toBeNull();
    expect(out!.properties!['$current_url']).toBe('https://app.scrollpop.io/c/42');
    expect(out!.properties!['$referrer']).toBe('https://google.com/search');
    expect(out!.properties!['$ip']).toBeUndefined();
    // Behavioral data is preserved — we minimize PII, we don't drop events/props.
    expect(out!.properties!['custom_prop']).toBe('keep-me');
  });

  it('passes a null event through without throwing', () => {
    expect(posthogBeforeSend(null)).toBeNull();
  });
});

describe('sentryBeforeSend', () => {
  it('deletes user, cookies, query_string and strips query strings', () => {
    const event = {
      user: { id: 'u1', email: 'a@b.com' },
      request: {
        url: 'https://app.scrollpop.io/x?a=1',
        cookies: 'session=1',
        query_string: 'a=1',
      },
      breadcrumbs: [{ category: 'navigation', data: { from: '/a?x=1', to: '/b?y=2' } }],
    };

    const out = sentryBeforeSend(event);

    expect(out.user).toBeUndefined();
    expect(out.request.cookies).toBeUndefined();
    expect(out.request.query_string).toBeUndefined();
    expect(out.request.url).toBe('https://app.scrollpop.io/x');
    expect(out.breadcrumbs[0]!.data.from).toBe('/a');
    expect(out.breadcrumbs[0]!.data.to).toBe('/b');
  });
});
