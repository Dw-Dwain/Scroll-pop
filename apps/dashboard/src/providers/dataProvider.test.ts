import { describe, it, expect, vi, afterEach } from 'vitest';
import { createDataProvider } from './dataProvider';

// Absolute URLs so resolveUrl() returns early and never touches `window` (tests run in node env).
const mockJson = (body: unknown, status = 200) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));

describe('dataProvider.custom', () => {
  afterEach(() => vi.restoreAllMocks());

  it('preserves meta alongside data', async () => {
    // The analytics endpoints return their CTR + dense trend `series` in `meta`. Dropping it here is
    // what made the campaign trend chart render empty and CTR read 0.00% — this guards that regression.
    const body = {
      data: [{ bucket: '2026-06-18T14:00:00Z', eventType: 'impression', count: 3 }],
      meta: { ctr: 0.5, granularity: 'hour', series: [{ bucket: '2026-06-18T14:00:00Z', impressions: 3 }] },
    };
    mockJson(body);
    const dp = createDataProvider(async () => 'tok');
    const res = await dp.custom!({ url: 'http://localhost/api/v1/analytics/campaigns/abc?hours=24', method: 'get' });

    expect(res.data).toEqual(body.data);
    expect((res as { meta?: unknown }).meta).toEqual(body.meta);
  });

  it('omits meta when the endpoint does not send it', async () => {
    const body = { data: [{ id: '1' }] };
    mockJson(body);
    const dp = createDataProvider(async () => null);
    const res = await dp.custom!({ url: 'http://localhost/api/v1/campaigns', method: 'get' });

    expect(res.data).toEqual(body.data);
    expect((res as { meta?: unknown }).meta).toBeUndefined();
  });
});
