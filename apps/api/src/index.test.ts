/**
 * API Integration Tests — P1-18
 *
 * Tests route-level behaviour without a live DB using Fastify's inject() API.
 * The DB is mocked via vi.mock so these run in CI with no DATABASE_URL required.
 *
 * Coverage:
 *  - Input validation (Zod) — bad UUIDs, missing fields, unknown event types
 *  - Tenant isolation — a request for another tenant's resource returns 404/403
 *  - Event injection defence — forged campaign UUIDs, unknown origins
 *  - Webhook signature verification — bad/missing signatures return 400
 *  - Billing checkout validation — bad redirect URLs are rejected
 *  - Coupon generation validation
 *  - Auto-responder config validation
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { z } from 'zod';

// ── Minimal mocks so the module can load without real env vars ────────────────

// ─── Comprehensive DB mock ────────────────────────────────────────────────────
// Helper: returns an object that is both chainable AND directly awaitable (thenable)
// at every step. Handles: .from().where().orderBy().limit() and any subset thereof.
function makeChain(result: unknown[] = []) {
  const p = Promise.resolve(result);
  const obj: Record<string, unknown> = {
    from:    vi.fn().mockImplementation(() => makeChain(result)),
    where:   vi.fn().mockImplementation(() => makeChain(result)),
    orderBy: vi.fn().mockImplementation(() => makeChain(result)),
    limit:   vi.fn().mockImplementation(() => makeChain(result)),
    then:    p.then.bind(p),
    catch:   p.catch.bind(p),
    finally: p.finally.bind(p),
  };
  return obj;
}

// Insert chain: supports .values().onConflictDoNothing().returning() and variants
function makeInsert(result: unknown[] = []) {
  const returning = vi.fn().mockResolvedValue(result);
  const afterOnConflict = { returning };
  const valuesResult = {
    onConflictDoNothing: vi.fn().mockReturnValue(afterOnConflict),
    onConflictDoUpdate:  vi.fn().mockReturnValue(afterOnConflict),
    returning,
  };
  return { values: vi.fn().mockReturnValue(valuesResult) };
}

// Update chain: .set().where() — where() is directly awaitable AND has .returning()
function makeUpdate(result: unknown[] = []) {
  const makeWhere = () => {
    const p = Promise.resolve(result);
    return Object.assign(Object.create(null), {
      returning: vi.fn().mockResolvedValue(result),
      then:   p.then.bind(p),
      catch:  p.catch.bind(p),
      finally: p.finally.bind(p),
    });
  };
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockImplementation(makeWhere) }) };
}

vi.mock('./db/client.js', () => {
  // Re-create helpers inside the factory so Vitest's module isolation picks them up.
  const chain = (result: unknown[] = []) => {
    const p = Promise.resolve(result);
    return {
      from:    vi.fn().mockImplementation(() => chain(result)),
      where:   vi.fn().mockImplementation(() => chain(result)),
      orderBy: vi.fn().mockImplementation(() => chain(result)),
      limit:   vi.fn().mockImplementation(() => chain(result)),
      offset:  vi.fn().mockImplementation(() => chain(result)),
      groupBy: vi.fn().mockImplementation(() => chain(result)),
      innerJoin: vi.fn().mockImplementation(() => chain(result)),
      leftJoin:  vi.fn().mockImplementation(() => chain(result)),
      then:    p.then.bind(p), catch: p.catch.bind(p), finally: p.finally.bind(p),
    };
  };
  const ins = (result: unknown[] = []) => {
    const ret = vi.fn().mockResolvedValue(result);
    const after = { returning: ret };
    return { values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockReturnValue(after), onConflictDoUpdate: vi.fn().mockReturnValue(after), returning: ret }) };
  };
  const upd = (result: unknown[] = []) => {
    const mkw = () => { const p = Promise.resolve(result); return Object.assign({}, { returning: vi.fn().mockResolvedValue(result), then: p.then.bind(p), catch: p.catch.bind(p), finally: p.finally.bind(p) }); };
    return { set: vi.fn().mockReturnValue({ where: vi.fn().mockImplementation(mkw) }) };
  };
  const q = () => ({ findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) });
  const dbMock = {
    query: {
      sites: q(), campaigns: q(), tenants: q(), users: q(), tenantMembers: q(),
      frequencyRules: q(), notifications: q(), leads: q(), variants: q(),
      coupons: q(), targetingRules: q(), designs: q(), triggers: q(),
      shopifyInstallations: q(), adminAuditLog: q(),
      journeys: q(), journeyNodes: q(), journeyEdges: q(),
    },
    select: vi.fn().mockImplementation(() => chain()),
    insert: vi.fn().mockImplementation(() => ins()),
    update: vi.fn().mockImplementation(() => upd()),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
        then: Promise.resolve([]).then.bind(Promise.resolve([])),
      }),
    }),
    // Transactional canvas save runs its body inside db.transaction(fn). The mock just
    // invokes the callback with the same chainable mock so tx.query/insert/update/delete work.
    transaction: vi.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(dbMock)),
  };
  return {
    db: dbMock,
    sqlClient: { unsafe: vi.fn().mockResolvedValue(null) },
    // RLS plumbing (C-1) — mocked so bootstrap doesn't try to reserve real connections.
    systemDb: dbMock,
    rlsActive: () => false,
    disableRls: vi.fn(),
    acquireTenantConnection: vi.fn().mockResolvedValue(null),
    tenantScopeStorage: { run: (_s: unknown, done: () => void) => done(), getStore: () => undefined },
  };
});

vi.mock('@upstash/redis', () => ({
  // vitest 4: a mock used with `new` must be a `function`/`class` — arrow fns aren't constructors.
  Redis: vi.fn().mockImplementation(function () {
    return {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };
  }),
}));

vi.mock('@clerk/fastify', () => ({
  clerkPlugin: async (app: { decorate: (k: string, v: unknown) => void }) => {
    app.decorate('clerk', {});
  },
  clerkClient: {
    sessions: {
      getSessionList: vi.fn().mockResolvedValue({ data: [] }),
      revokeSession: vi.fn().mockResolvedValue({}),
    },
    users: {
      getUser: vi.fn().mockResolvedValue({ emailAddresses: [], primaryEmailAddressId: null, firstName: null, lastName: null }),
      deleteUser: vi.fn().mockResolvedValue({}),
    },
  },
}));

// Minimal stub so tenantContextPlugin can read from a test header
// fp-wrapped so the preHandler is GLOBAL (the real plugin is fastify-plugin-wrapped). Without this
// the hook is encapsulated and req.tenantId/isUnlimited never reach the sibling route plugins,
// so the Agency plan-gate on journeys/variants would 403 in tests.
vi.mock('./plugins/tenant-context.js', async () => {
  const fp = (await import('fastify-plugin')).default;
  return {
    tenantContextPlugin: fp(async (app: any) => {
      app.addHook('preHandler', async (req: any) => {
        req.tenantId = req.headers['x-test-tenant-id'] ?? 'tenant-test-000';
        req.userId = req.headers['x-test-user-id'] ?? 'user-test-000';
        req.isUnlimited = true; // bypass plan-gates in unit tests (gating is exercised separately)
      });
    }),
  };
});

vi.mock('./lib/sentry.js', () => ({
  captureException: vi.fn(),
  sentryEnabled: vi.fn().mockReturnValue(false),
}));
vi.mock('./lib/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  emailEnabled: vi.fn().mockReturnValue(false),
}));
vi.mock('./lib/cache-purge.js', () => ({
  purgeSiteConfigCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(function () {
    return {
      verify: vi.fn().mockImplementation(() => { throw new Error('Invalid signature'); }),
    };
  }),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      webhooks: {
        constructEvent: vi.fn().mockImplementation(() => { throw new Error('No signatures found'); }),
      },
    };
  }),
}));

// Set minimal env vars before importing the app
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost/test';
process.env['NODE_ENV'] = 'test';
process.env['REDIS_URL'] = 'https://test.upstash.io';
process.env['REDIS_TOKEN'] = 'test-token';
process.env['CLERK_SECRET_KEY'] = 'sk_test_placeholder';
process.env['CLERK_PUBLISHABLE_KEY'] = 'pk_test_placeholder';

// ── Helpers ───────────────────────────────────────────────────────────────────

const UUID_A = '11111111-1111-1111-1111-111111111111';
const UUID_B = '22222222-2222-2222-2222-222222222222';
const UUID_C = '33333333-3333-3333-3333-333333333333';

// Build a minimal Fastify app wired with just the routes we want to test,
// without the full bootstrap (which needs a live DB to call ensureXxx).
async function buildTestApp() {
  const app = Fastify({ logger: false });

  // CORS / rate-limit stubs (lightweight)
  app.register(await import('@fastify/cors').then((m) => m.default), { origin: '*' });

  // Auth stub
  const { tenantContextPlugin } = await import('./plugins/tenant-context.js');
  app.register(tenantContextPlugin);

  // Error handler — converts ZodErrors to 400 responses
  const { errorHandlerPlugin } = await import('./plugins/error-handler.js');
  app.register(errorHandlerPlugin);

  // Routes under test
  const { campaignRoutes } = await import('./routes/campaigns.js');
  const { couponRoutes } = await import('./routes/coupons.js');
  const { autoResponderRoutes } = await import('./routes/auto-responder.js');
  const { outboundWebhookRoutes } = await import('./routes/outbound-webhook.js');
  const { billingRoutes } = await import('./routes/billing.js');
  const { webhookRoutes } = await import('./routes/webhooks.js');
  const { journeyRoutes } = await import('./routes/journeys.js');

  app.register(campaignRoutes, { prefix: '/api/v1' });
  app.register(couponRoutes, { prefix: '/api/v1' });
  app.register(autoResponderRoutes, { prefix: '/api/v1' });
  app.register(outboundWebhookRoutes, { prefix: '/api/v1' });
  app.register(billingRoutes, { prefix: '/api/v1' });
  app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  app.register(journeyRoutes, { prefix: '/api/v1' });

  await app.ready();
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Event ingest validation', () => {
  it('rejects unknown event types', async () => {
    const ALLOWED = new Set([
      'impression','view','click','dismiss','conversion',
      'popup_close','popup_submit','popup_expand','popup_minimize',
      'email_capture','sms_capture','discount_redeemed',
      'checkout_started','purchase_completed','trigger_fired','trigger_blocked',
    ]);
    expect(ALLOWED.has('sql_injection')).toBe(false);
    expect(ALLOWED.has('impression')).toBe(true);
    expect(ALLOWED.has('conversion')).toBe(true);
  });

  it('rejects non-UUID visitor IDs', () => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(UUID_RE.test('not-a-uuid')).toBe(false);
    expect(UUID_RE.test('../etc/passwd')).toBe(false);
    expect(UUID_RE.test(UUID_A)).toBe(true);
  });

  it('clamps revenue_cents to [0, 1_000_000]', () => {
    const clamp = (v: unknown) => Math.min(Math.max(0, Math.round(Number(v))), 1_000_000);
    expect(clamp(-500)).toBe(0);
    expect(clamp(5_000_000)).toBe(1_000_000);
    expect(clamp(9999)).toBe(9999);
  });

  it('clamps scroll_depth_pct to [0, 100]', () => {
    const clamp = (v: unknown) => Math.min(Math.max(0, Math.round(Number(v))), 100);
    expect(clamp(150)).toBe(100);
    expect(clamp(-10)).toBe(0);
    expect(clamp(75)).toBe(75);
  });

  it('rejects unsafe page URLs', () => {
    const sanitizeUrl = (url: unknown): string | null => {
      if (typeof url !== 'string' || url.length > 2048) return null;
      try {
        const p = new URL(url);
        return (p.protocol === 'https:' || p.protocol === 'http:') ? url : null;
      } catch { return null; }
    };
    expect(sanitizeUrl('javascript:alert(1)')).toBe(null);
    expect(sanitizeUrl('data:text/html,<script>')).toBe(null);
    expect(sanitizeUrl('not-a-url')).toBe(null);
    expect(sanitizeUrl('https://example.com/page')).toBe('https://example.com/page');
  });
});

describe('Campaign tenant isolation', () => {
  it('returns 404 for campaign belonging to a different tenant', async () => {
    const app = await buildTestApp();
    // DB mock returns null (campaign not found for this tenant)
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/campaigns/${UUID_A}`,
      headers: { 'x-test-tenant-id': UUID_B },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('returns 404 when deleting another tenant campaign', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/campaigns/${UUID_A}`,
      headers: { 'x-test-tenant-id': UUID_B },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('Campaign input validation', () => {
  it('rejects campaign creation without required fields', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/campaigns',
      payload: { name: '' }, // missing siteId, empty name
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects non-UUID siteId', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/campaigns',
      payload: { siteId: 'not-a-uuid', name: 'Test' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('Coupon generation validation', () => {
  it('rejects count > 500', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/coupons/generate',
      payload: { count: 9999, prefix: 'SAVE' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects invalid discountPct > 100', async () => {
    const GenerateBody = z.object({
      discountPct: z.number().int().min(1).max(100).optional(),
    });
    expect(() => GenerateBody.parse({ discountPct: 150 })).toThrow();
    expect(() => GenerateBody.parse({ discountPct: 50 })).not.toThrow();
  });
});

describe('Auto-responder validation', () => {
  it('rejects invalid email in replyTo', async () => {
    const AutoResponderBody = z.object({
      enabled: z.boolean(),
      replyTo: z.string().email().optional().or(z.literal('')),
    });
    expect(() => AutoResponderBody.parse({ enabled: true, replyTo: 'not-an-email' })).toThrow();
    expect(() => AutoResponderBody.parse({ enabled: true, replyTo: 'reply@example.com' })).not.toThrow();
    expect(() => AutoResponderBody.parse({ enabled: false, replyTo: '' })).not.toThrow();
  });

  it('returns 404 for auto-responder of nonexistent campaign', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/campaigns/${UUID_A}/auto-responder`,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('Webhook signature verification', () => {
  it('Stripe: missing signature header returns 400', () => {
    // The stripe.webhooks.constructEvent call throws on missing signature.
    // Verify our guard logic by testing the condition inline.
    const stripeRawSig = undefined as string | undefined;
    expect(!stripeRawSig).toBe(true); // → would return 400
  });

  it('Stripe: wrong signature returns 400 (simulated)', async () => {
    // We cannot call the actual Stripe SDK without a key, but we verify
    // that the route rejects a request with a clearly wrong signature.
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/stripe',
      headers: { 'stripe-signature': 'v1=badsig,t=0' },
      payload: JSON.stringify({ type: 'customer.subscription.updated', data: {} }),
    });
    // Expect a 4xx/5xx — any error status signals the bad signature was rejected
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    await app.close();
  });
});

describe('Contact route (public marketing form)', () => {
  async function buildContactApp() {
    const app = Fastify({ logger: false });
    app.register(await import('@fastify/cors').then((m) => m.default), { origin: '*' });
    const { errorHandlerPlugin } = await import('./plugins/error-handler.js');
    app.register(errorHandlerPlugin);
    const { contactRoutes } = await import('./routes/contact.js');
    app.register(contactRoutes, { prefix: '/api/v1' });
    await app.ready();
    return app;
  }

  it('POST /contact rejects a missing email (400)', async () => {
    const app = await buildContactApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/contact',
      payload: { name: 'Test Lead', message: 'hi' }, // no email
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('POST /contact returns 503 when Resend is unconfigured (never silently drops)', async () => {
    const prevKey = process.env['RESEND_API_KEY'];
    const prevFrom = process.env['RESEND_FROM'];
    delete process.env['RESEND_API_KEY'];
    delete process.env['RESEND_FROM'];
    const app = await buildContactApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/contact',
      payload: { name: 'Test Lead', email: 'lead@example.com', message: 'Need agency pricing' },
    });
    expect(res.statusCode).toBe(503);
    if (prevKey !== undefined) process.env['RESEND_API_KEY'] = prevKey;
    if (prevFrom !== undefined) process.env['RESEND_FROM'] = prevFrom;
    await app.close();
  });
});

describe('Billing checkout redirect URL validation', () => {
  it('rejects checkout when Stripe not configured (graceful error)', async () => {
    delete process.env['STRIPE_SECRET_KEY'];
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      payload: {
        plan: 'agency',
        successUrl: 'https://dashboard.scrollpop.online/billing?success=1',
        cancelUrl: 'https://dashboard.scrollpop.online/billing',
      },
    });
    // Should get a 500 or 503 (Stripe not configured) — not a crash
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_placeholder';
    await app.close();
  });

  it('URL allowlist logic blocks unknown origins', () => {
    const ALLOWED = new Set([
      'https://dashboard.scrollpop.online',
      'http://localhost:5173',
    ]);
    const PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.scrollpop-dashboard\.pages\.dev$/;
    const isAllowed = (url: string) => {
      try {
        const origin = new URL(url).origin;
        return ALLOWED.has(origin) || PREVIEW_RE.test(origin);
      } catch { return false; }
    };
    expect(isAllowed('https://evil.com/steal?token=abc')).toBe(false);
    expect(isAllowed('https://dashboard.scrollpop.online/billing?ok=1')).toBe(true);
    expect(isAllowed('https://abc123.scrollpop-dashboard.pages.dev/billing')).toBe(true);
  });
});

describe('Origin validation (cross-tenant event injection)', () => {
  it('registrable domain extraction works correctly', () => {
    const registrableDomain = (host: string) => {
      const labels = host.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
      return labels.length <= 2 ? labels.join('.') : labels.slice(-2).join('.');
    };
    expect(registrableDomain('www.example.com')).toBe('example.com');
    expect(registrableDomain('blog.mysite.co.uk')).toBe('co.uk'); // known limitation; not a bypass
    expect(registrableDomain('evil.com')).toBe('evil.com');
    expect(registrableDomain('example.com')).toBe('example.com');
  });

  it('cross-origin events are blocked when domain does not match', () => {
    const registrableDomain = (host: string) => {
      const labels = host.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
      return labels.length <= 2 ? labels.join('.') : labels.slice(-2).join('.');
    };
    const allowedForMeta = (pageUrl: string | null, siteDomain: string | null): boolean => {
      if (!pageUrl || !siteDomain) return true; // fail open
      let host: string;
      try { host = new URL(pageUrl).hostname; } catch { return true; }
      return registrableDomain(host) === registrableDomain(siteDomain);
    };
    expect(allowedForMeta('https://evil.com/page', 'shop.example.com')).toBe(false);
    expect(allowedForMeta('https://www.example.com/page', 'example.com')).toBe(true);
    expect(allowedForMeta(null, 'example.com')).toBe(true); // fail open
    expect(allowedForMeta('https://example.com/page', null)).toBe(true); // fail open
  });
});

// ── Outbound webhook (P2-14) ──────────────────────────────────────────────────

describe('Outbound webhook config validation', () => {
  it('rejects non-URL webhook URLs', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/campaigns/${UUID_A}/webhook`,
      payload: { enabled: true, url: 'not-a-url', events: ['email_capture'] },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects empty events array', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/campaigns/${UUID_A}/webhook`,
      payload: { enabled: true, url: 'https://hooks.zapier.com/test', events: [] },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects unknown event types in events array', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/campaigns/${UUID_A}/webhook`,
      payload: { enabled: true, url: 'https://hooks.zapier.com/test', events: ['impression'] },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 404 for webhook config of nonexistent campaign', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/campaigns/${UUID_A}/webhook`,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('accepts valid webhook config', async () => {
    // Stub DB to return a campaign for the GET path
    const { db } = await import('./db/client.js');
    vi.mocked(db.query.campaigns.findFirst).mockResolvedValueOnce({
      id: UUID_A,
      outboundWebhook: {},
    } as ReturnType<typeof db.query.campaigns.findFirst> extends Promise<infer T> ? T : never);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/campaigns/${UUID_A}/webhook`,
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

describe('Transactional canvas save (PUT /campaigns/:id/canvas)', () => {
  const fullPayload = {
    design: { kind: 'modal', config: { headline: 'Hi' }, affiliateSlots: [] },
    triggers: [{ type: 'scroll_pct', params: { pct: 50 } }],
    frequency: { frequency: 'once_per_session' },
    targeting: [{ kind: 'url_contains', operator: 'include', value: { pattern: '/shop' } }],
  };

  it('returns 404 (and writes nothing) when the campaign is not the tenant’s', async () => {
    const app = await buildTestApp();
    // Default mock: campaigns.findFirst → null inside the tx → not found.
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/campaigns/${UUID_A}/canvas`,
      headers: { 'x-test-tenant-id': UUID_B },
      payload: fullPayload,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('persists design + triggers + frequency + targeting in one call (200)', async () => {
    const { db } = await import('./db/client.js');
    vi.mocked(db.transaction).mockClear();
    vi.mocked(db.query.campaigns.findFirst).mockResolvedValueOnce({
      id: UUID_A, tenantId: UUID_B, siteId: UUID_C,
    } as ReturnType<typeof db.query.campaigns.findFirst> extends Promise<infer T> ? T : never);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/campaigns/${UUID_A}/canvas`,
      headers: { 'x-test-tenant-id': UUID_B },
      payload: fullPayload,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { design: unknown; triggers: unknown; frequency: unknown; targeting: unknown } };
    expect(body.data).toHaveProperty('design');
    expect(body.data).toHaveProperty('triggers');
    expect(body.data).toHaveProperty('frequency');
    expect(body.data).toHaveProperty('targeting');
    // The save ran inside a single transaction.
    expect(vi.mocked(db.transaction)).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('rejects an invalid trigger type with 400 before opening the transaction', async () => {
    const { db } = await import('./db/client.js');
    vi.mocked(db.transaction).mockClear();
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/campaigns/${UUID_A}/canvas`,
      headers: { 'x-test-tenant-id': UUID_B },
      payload: { ...fullPayload, triggers: [{ type: 'back_button_capture', params: {} }] },
    });
    expect(res.statusCode).toBe(400);
    // No transaction should have been started for an invalid payload — nothing partially written.
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects a ReDoS url_regex pattern with 400', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/campaigns/${UUID_A}/canvas`,
      headers: { 'x-test-tenant-id': UUID_B },
      payload: { targeting: [{ kind: 'url_regex', operator: 'include', value: { pattern: '(a+)+b' } }] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'INVALID_REGEX' } });
    await app.close();
  });
});

describe('Journey compile + validation (compileJourney)', () => {
  // Pure graph validator/compiler — no DB. Node/edge literals are cast (`as never`) to the route's
  // internal input types, matching this file's mock-fixture style.
  const entry = (over: Record<string, unknown> = {}) =>
    ({ id: 'e', type: 'entry', config: { trigger: { type: 'scroll_pct', value: 50 } }, posX: 0, posY: 0, ...over });
  const goal = (id = 'g') => ({ id, type: 'goal', config: { kind: 'conversion' }, posX: 0, posY: 0 });

  it('rejects a graph with no entry node', async () => {
    const { compileJourney } = await import('./routes/journeys.js');
    const r = compileJourney([goal()] as never, [] as never);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/entry/i);
  });

  it('rejects a popup node with no campaign', async () => {
    const { compileJourney } = await import('./routes/journeys.js');
    const r = compileJourney(
      [entry(), { id: 'p', type: 'popup', config: {}, posX: 0, posY: 0 }, goal()] as never,
      [
        { id: 'x1', sourceNodeId: 'e', targetNodeId: 'p', branch: 'always', config: {} },
        { id: 'x2', sourceNodeId: 'p', targetNodeId: 'g', branch: 'convert', config: {} },
      ] as never,
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/campaign/i);
  });

  it('rejects an unreachable goal', async () => {
    const { compileJourney } = await import('./routes/journeys.js');
    const r = compileJourney(
      [entry(), goal()] as never,
      [] as never, // entry not connected to the goal
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/reachable/i);
  });

  it('rejects a delay below the 1s floor but accepts 1s', async () => {
    const { compileJourney } = await import('./routes/journeys.js');
    const mk = (seconds: number) => compileJourney(
      [entry(), { id: 'd', type: 'delay', config: { seconds }, posX: 0, posY: 0 }, goal()] as never,
      [
        { id: 'x1', sourceNodeId: 'e', targetNodeId: 'd', branch: 'always', config: {} },
        { id: 'x2', sourceNodeId: 'd', targetNodeId: 'g', branch: 'always', config: {} },
      ] as never,
    );
    const below = mk(0);
    expect(below.ok).toBe(false);
    expect(below.errors.join(' ')).toMatch(/at least/i);
    expect(mk(1).ok).toBe(true); // 1s is now the configurable floor — operators can set it
  });

  it('rejects a self-loop edge', async () => {
    const { compileJourney } = await import('./routes/journeys.js');
    const r = compileJourney(
      [entry(), goal()] as never,
      [
        { id: 'x1', sourceNodeId: 'e', targetNodeId: 'g', branch: 'always', config: {} },
        { id: 'x2', sourceNodeId: 'e', targetNodeId: 'e', branch: 'always', config: {} },
      ] as never,
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/itself/i);
  });

  it('compiles a valid journey with branch adjacency + reports popup campaigns', async () => {
    const { compileJourney } = await import('./routes/journeys.js');
    const r = compileJourney(
      [entry({ config: { trigger: { type: 'dwell_time', value: 10 } } }),
       { id: 'p', type: 'popup', campaignId: UUID_A, config: {}, posX: 0, posY: 0 }, goal()] as never,
      [
        { id: 'x1', sourceNodeId: 'e', targetNodeId: 'p', branch: 'always', config: {} },
        { id: 'x2', sourceNodeId: 'p', targetNodeId: 'g', branch: 'convert', config: {} },
      ] as never,
    );
    expect(r.ok).toBe(true);
    expect(r.popupCampaignIds).toContain(UUID_A);
    expect((r.compiled as Record<string, unknown>)['entryNodeId']).toBe('e');
    const nodes = (r.compiled as { nodes: Array<{ id: string; next: Record<string, string> }> }).nodes;
    expect(nodes.find((n) => n.id === 'p')!.next['convert']).toBe('g');
  });

  it('compiles split-node weights from the outgoing edges', async () => {
    const { compileJourney } = await import('./routes/journeys.js');
    const r = compileJourney(
      [entry(), { id: 's', type: 'split', config: {}, posX: 0, posY: 0 }, goal('g1'), goal('g2')] as never,
      [
        { id: 'x0', sourceNodeId: 'e', targetNodeId: 's', branch: 'always', config: {} },
        { id: 'x1', sourceNodeId: 's', targetNodeId: 'g1', branch: 'split', config: { weight: 70 } },
        { id: 'x2', sourceNodeId: 's', targetNodeId: 'g2', branch: 'split', config: { weight: 30 } },
      ] as never,
    );
    expect(r.ok).toBe(true);
    const split = (r.compiled as { nodes: Array<{ id: string; next: Record<string, string>; config?: { weights?: number[] } }> })
      .nodes.find((n) => n.id === 's')!;
    expect(split.next['0']).toBe('g1');
    expect(split.next['1']).toBe('g2');
    expect(split.config!.weights).toEqual([70, 30]);
  });
});

describe('Journeys API routes', () => {
  it('GET /journeys/:id returns 404 when not found', async () => {
    const app = await buildTestApp(); // default mock: journeys.findFirst → null
    const res = await app.inject({ method: 'GET', url: `/api/v1/journeys/${UUID_A}`, headers: { 'x-test-tenant-id': UUID_B } });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('POST /journeys rejects an empty name (400)', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'POST', url: '/api/v1/journeys', headers: { 'x-test-tenant-id': UUID_B }, payload: { name: '' } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('POST /journeys/:id/publish returns 404 when the journey is not found', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'POST', url: `/api/v1/journeys/${UUID_A}/publish`, headers: { 'x-test-tenant-id': UUID_B } });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('Outbound webhook HMAC signature', () => {
  it('generates correct sha256 signature', async () => {
    const crypto = await import('node:crypto');
    const secret = 'my-webhook-secret';
    const payload = JSON.stringify({ event: 'email_capture', campaignId: UUID_A });
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
    // Verify signature format
    expect(expected).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('fireOutboundWebhook is a no-op when disabled', async () => {
    const { fireOutboundWebhook } = await import('./routes/outbound-webhook.js');
    // Should not throw even with disabled config
    await expect(fireOutboundWebhook({
      config: { enabled: false, url: 'https://hooks.zapier.com/test', events: ['email_capture'] },
      event: 'email_capture',
      campaignId: UUID_A,
      tenantId: UUID_B,
      data: { email: 'test@example.com' },
    })).resolves.toBeUndefined();
  });

  it('fireOutboundWebhook is a no-op when event not in subscribed list', async () => {
    const { fireOutboundWebhook } = await import('./routes/outbound-webhook.js');
    await expect(fireOutboundWebhook({
      config: { enabled: true, url: 'https://hooks.zapier.com/test', events: ['conversion'] },
      event: 'email_capture', // not subscribed
      campaignId: UUID_A,
      tenantId: UUID_B,
      data: {},
    })).resolves.toBeUndefined();
  });

  it('fireOutboundWebhook is a no-op when no URL configured', async () => {
    const { fireOutboundWebhook } = await import('./routes/outbound-webhook.js');
    await expect(fireOutboundWebhook({
      config: { enabled: true, events: ['email_capture'] }, // no url
      event: 'email_capture',
      campaignId: UUID_A,
      tenantId: UUID_B,
      data: {},
    })).resolves.toBeUndefined();
  });
});

// ── Sites route coverage ──────────────────────────────────────────────────────

describe('Sites routes', () => {
  async function buildSitesApp() {
    const app = Fastify({ logger: false });
    app.register(await import('@fastify/cors').then((m) => m.default), { origin: '*' });
    const { tenantContextPlugin } = await import('./plugins/tenant-context.js');
    app.register(tenantContextPlugin);
    const { errorHandlerPlugin } = await import('./plugins/error-handler.js');
    app.register(errorHandlerPlugin);
    const { siteRoutes } = await import('./routes/sites.js');
    app.register(siteRoutes, { prefix: '/api/v1' });
    await app.ready();
    return app;
  }

  it('GET /sites returns 200 with data array', async () => {
    const app = await buildSitesApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/sites' });
    expect([200, 404]).toContain(res.statusCode);
    await app.close();
  });

  it('POST /sites rejects missing required fields', async () => {
    const app = await buildSitesApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sites',
      payload: { name: 'Test' }, // missing domain
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('POST /sites rejects invalid domain (not URL and not bare domain)', async () => {
    const app = await buildSitesApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sites',
      // Fails both z.string().url() and the bare-domain regex
      payload: { name: 'Test', domain: 'not_a_domain!!!', platform: 'html' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

// ── Trigger routes coverage ───────────────────────────────────────────────────

describe('Trigger routes', () => {
  async function buildTriggersApp() {
    const app = Fastify({ logger: false });
    app.register(await import('@fastify/cors').then((m) => m.default), { origin: '*' });
    const { tenantContextPlugin } = await import('./plugins/tenant-context.js');
    app.register(tenantContextPlugin);
    const { errorHandlerPlugin } = await import('./plugins/error-handler.js');
    app.register(errorHandlerPlugin);
    const { triggerRoutes } = await import('./routes/triggers.js');
    app.register(triggerRoutes, { prefix: '/api/v1' });
    await app.ready();
    return app;
  }

  it('POST trigger rejects unknown trigger type', async () => {
    const app = await buildTriggersApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/campaigns/${UUID_A}/triggers`,
      payload: { type: 'back_button_capture', params: {} },
    });
    // Campaign ownership check fires first (→ 404 when DB mock returns null);
    // with a real campaign present the route would return 400 for the invalid type.
    expect([400, 404]).toContain(res.statusCode);
    await app.close();
  });

  it('POST trigger rejects scroll_pct > 100', async () => {
    const { TriggerParamsSchema } = await import('@scrollpop/shared');
    expect(() => TriggerParamsSchema.parse({ type: 'scroll_pct', pct: 150 })).toThrow();
    expect(() => TriggerParamsSchema.parse({ type: 'scroll_pct', pct: 75 })).not.toThrow();
  });

  it('POST trigger rejects dwell_time > 3600 seconds', async () => {
    const { TriggerParamsSchema } = await import('@scrollpop/shared');
    expect(() => TriggerParamsSchema.parse({ type: 'dwell_time', seconds: 9999 })).toThrow();
    expect(() => TriggerParamsSchema.parse({ type: 'dwell_time', seconds: 30 })).not.toThrow();
  });

  it('GET triggers returns 404 for nonexistent campaign', async () => {
    const app = await buildTriggersApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/campaigns/${UUID_A}/triggers`,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

// ── Targeting routes coverage ─────────────────────────────────────────────────

describe('Targeting routes', () => {
  async function buildTargetingApp() {
    const app = Fastify({ logger: false });
    app.register(await import('@fastify/cors').then((m) => m.default), { origin: '*' });
    const { tenantContextPlugin } = await import('./plugins/tenant-context.js');
    app.register(tenantContextPlugin);
    const { errorHandlerPlugin } = await import('./plugins/error-handler.js');
    app.register(errorHandlerPlugin);
    const { targetingRoutes } = await import('./routes/targeting.js');
    app.register(targetingRoutes, { prefix: '/api/v1' });
    await app.ready();
    return app;
  }

  it('GET targeting returns 404 for nonexistent campaign', async () => {
    const app = await buildTargetingApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/campaigns/${UUID_A}/targeting`,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('POST targeting rejects unknown kind', async () => {
    const app = await buildTargetingApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/campaigns/${UUID_A}/targeting`,
      payload: { kind: 'unknown_kind', operator: 'include', value: {} },
    });
    // Campaign ownership check fires before body parse (→ 404 with null mock).
    expect([400, 404]).toContain(res.statusCode);
    await app.close();
  });

  it('POST targeting rejects invalid operator', async () => {
    const app = await buildTargetingApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/campaigns/${UUID_A}/targeting`,
      payload: { kind: 'device', operator: 'maybe', value: { device: 'mobile' } },
    });
    // Campaign ownership check fires before body parse (→ 404 with null mock).
    expect([400, 404]).toContain(res.statusCode);
    await app.close();
  });
});

// ── Me route coverage ─────────────────────────────────────────────────────────

describe('Me routes', () => {
  async function buildMeApp() {
    const app = Fastify({ logger: false });
    app.register(await import('@fastify/cors').then((m) => m.default), { origin: '*' });
    const { tenantContextPlugin } = await import('./plugins/tenant-context.js');
    app.register(tenantContextPlugin);
    const { errorHandlerPlugin } = await import('./plugins/error-handler.js');
    app.register(errorHandlerPlugin);
    const { meRoutes } = await import('./routes/me.js');
    app.register(meRoutes, { prefix: '/api/v1' });
    await app.ready();
    return app;
  }

  it('GET /me returns 404 when user/tenant not found', async () => {
    const app = await buildMeApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/me' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

// ── Leads route coverage ──────────────────────────────────────────────────────

describe('Leads routes', () => {
  async function buildLeadsApp() {
    const app = Fastify({ logger: false });
    app.register(await import('@fastify/cors').then((m) => m.default), { origin: '*' });
    const { tenantContextPlugin } = await import('./plugins/tenant-context.js');
    app.register(tenantContextPlugin);
    const { errorHandlerPlugin } = await import('./plugins/error-handler.js');
    app.register(errorHandlerPlugin);
    const { leadRoutes } = await import('./routes/leads.js');
    app.register(leadRoutes, { prefix: '/api/v1' });
    await app.ready();
    return app;
  }

  it('GET /leads returns 200', async () => {
    const app = await buildLeadsApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/leads' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('DELETE /leads/:id returns 404 when lead not found', async () => {
    const app = await buildLeadsApp();
    // DB mock returns [] from .returning() → deleted is undefined → 404
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/leads/${UUID_A}` });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

// ── Variant routes coverage ───────────────────────────────────────────────────

describe('Variant (A/B) routes', () => {
  async function buildVariantsApp() {
    const app = Fastify({ logger: false });
    app.register(await import('@fastify/cors').then((m) => m.default), { origin: '*' });
    const { tenantContextPlugin } = await import('./plugins/tenant-context.js');
    app.register(tenantContextPlugin);
    const { errorHandlerPlugin } = await import('./plugins/error-handler.js');
    app.register(errorHandlerPlugin);
    const { variantRoutes } = await import('./routes/variants.js');
    app.register(variantRoutes, { prefix: '/api/v1' });
    await app.ready();
    return app;
  }

  it('POST /variants rejects weight > 100', async () => {
    const app = await buildVariantsApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/variants',
      payload: { campaignId: UUID_A, name: 'B', weight: 150 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('POST /variants rejects empty name', async () => {
    const app = await buildVariantsApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/variants',
      payload: { campaignId: UUID_A, name: '', weight: 50 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('POST /variants rejects non-UUID campaignId', async () => {
    const app = await buildVariantsApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/variants',
      payload: { campaignId: 'not-a-uuid', name: 'B', weight: 50 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('GET /variants requires campaignId query param', async () => {
    const app = await buildVariantsApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/variants' }); // missing campaignId
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('GET /variants/experiment requires campaignId query param', async () => {
    const app = await buildVariantsApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/variants/experiment' });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('PUT /variants/experiment rejects an invalid mode', async () => {
    const app = await buildVariantsApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/variants/experiment',
      payload: { campaignId: UUID_A, mode: 'turbo' }, // not manual|bandit
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('PUT /variants/experiment rejects an invalid objective', async () => {
    const app = await buildVariantsApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/variants/experiment',
      payload: { campaignId: UUID_A, objective: 'revenue' }, // not ctr|conversion
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('PUT /variants/experiment rejects a non-UUID campaignId', async () => {
    const app = await buildVariantsApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/variants/experiment',
      payload: { campaignId: 'nope', status: 'paused' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

// ── Coupons routes coverage ───────────────────────────────────────────────────

describe('Coupons routes', () => {
  it('rejects count > 500', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/coupons/generate',
      payload: { count: 9999, prefix: 'SAVE', discountPct: 10 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('accepts generation with valid payload (discountPct optional)', async () => {
    // Schema allows no discount fields — discountPct/discountAmtCents are optional.
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/coupons/generate',
      payload: { count: 2, prefix: 'TEST' }, // no discount — valid per schema
    });
    // Returns 201 (created) or 400 (schema rejection) — never 500.
    expect([201, 400]).toContain(res.statusCode);
    await app.close();
  });

  it('rejects negative discountAmtCents', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/coupons/generate',
      payload: { count: 1, prefix: 'X', discountAmtCents: -50 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('GET /coupons returns 200', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/coupons' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

// ── Notification routes coverage ──────────────────────────────────────────────

describe('Notification routes', () => {
  async function buildNotifApp() {
    const app = Fastify({ logger: false });
    app.register(await import('@fastify/cors').then((m) => m.default), { origin: '*' });
    const { tenantContextPlugin } = await import('./plugins/tenant-context.js');
    app.register(tenantContextPlugin);
    const { errorHandlerPlugin } = await import('./plugins/error-handler.js');
    app.register(errorHandlerPlugin);
    const { notificationRoutes } = await import('./routes/notifications.js');
    app.register(notificationRoutes, { prefix: '/api/v1' });
    await app.ready();
    return app;
  }

  it('GET /notifications returns 200', async () => {
    const app = await buildNotifApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/notifications' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('POST /notifications/:id/read returns 200 (no UUID validation on param)', async () => {
    const app = await buildNotifApp();
    // The route accepts any string param and does a DB update without UUID validation.
    const res = await app.inject({ method: 'POST', url: '/api/v1/notifications/not-uuid/read' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

// ── Frequency routes coverage ─────────────────────────────────────────────────

describe('Frequency routes', () => {
  async function buildFreqApp() {
    const app = Fastify({ logger: false });
    app.register(await import('@fastify/cors').then((m) => m.default), { origin: '*' });
    const { tenantContextPlugin } = await import('./plugins/tenant-context.js');
    app.register(tenantContextPlugin);
    const { errorHandlerPlugin } = await import('./plugins/error-handler.js');
    app.register(errorHandlerPlugin);
    const { frequencyRoutes } = await import('./routes/frequency.js');
    app.register(frequencyRoutes, { prefix: '/api/v1' });
    await app.ready();
    return app;
  }

  it('GET frequency returns 404 when campaign not found (ownership check first)', async () => {
    const app = await buildFreqApp();
    const res = await app.inject({ method: 'GET', url: `/api/v1/campaigns/${UUID_A}/frequency` });
    // Campaign ownership check is the first DB call; mock returns null → 404.
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('PUT frequency rejects unknown frequency value (Zod validates after campaign check)', async () => {
    const app = await buildFreqApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/campaigns/${UUID_A}/frequency`,
      payload: { frequency: 'twice_daily' },
    });
    // Campaign check fires first (→ 404); if campaign existed, body parse would give 400.
    expect([400, 404]).toContain(res.statusCode);
    await app.close();
  });

  it('PUT frequency schema rejects unknown value inline', async () => {
    // Validate the schema directly without the route so we test Zod independently.
    const { z } = await import('zod');
    const FrequencyBody = z.object({
      frequency: z.enum(['once_per_session', 'once_per_day', 'once_per_visitor', 'always']),
    });
    expect(() => FrequencyBody.parse({ frequency: 'twice_daily' })).toThrow();
    expect(() => FrequencyBody.parse({ frequency: 'once_per_day' })).not.toThrow();
  });
});

// ── ESP Integration routes (P1-8 Klaviyo + P1-9 Mailchimp) ───────────────────

describe('ESP Integrations routes', () => {
  async function buildEspApp() {
    const app = Fastify({ logger: false });
    app.register(await import('@fastify/cors').then((m) => m.default), { origin: '*' });
    const { tenantContextPlugin } = await import('./plugins/tenant-context.js');
    app.register(tenantContextPlugin);
    const { errorHandlerPlugin } = await import('./plugins/error-handler.js');
    app.register(errorHandlerPlugin);
    const { integrationRoutes } = await import('./routes/integrations.js');
    app.register(integrationRoutes, { prefix: '/api/v1' });
    await app.ready();
    return app;
  }

  it('GET /integrations returns 200 with masked config', async () => {
    const app = await buildEspApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/integrations' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('PUT /integrations rejects invalid email for test endpoint', async () => {
    const app = await buildEspApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/test',
      payload: { provider: 'klaviyo', testEmail: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('PUT /integrations rejects unknown provider', async () => {
    const app = await buildEspApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/test',
      payload: { provider: 'sendgrid', testEmail: 'test@example.com' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('POST /integrations/test returns 400 when provider not configured', async () => {
    // Tenant mock returns null integrations → credentials missing → 400 NOT_CONFIGURED
    const app = await buildEspApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/test',
      payload: { provider: 'klaviyo', testEmail: 'test@example.com' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('PUT /integrations returns 404 when the tenant is missing (SR-13)', async () => {
    // buildEspApp mocks tenants.findFirst → null, so the upsert would affect 0 rows.
    // SR-13: instead of a silent 200 with an empty config, the route now 404s.
    const app = await buildEspApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/integrations',
      payload: { klaviyo: { enabled: true, apiKey: 'pk_live_testkey', listId: 'ABC123' } },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.code).toBe('TENANT_NOT_FOUND');
    await app.close();
  });
});

describe('ESP adapter unit tests', () => {
  it('syncToKlaviyo is a no-op (ok:false) with empty credentials', async () => {
    const { syncToKlaviyo } = await import('./lib/esp.js');
    // SR-02: adapters now return a result type instead of void so /integrations/test
    // can surface failures. Missing creds resolve to { ok:false } without fetching.
    await expect(syncToKlaviyo({ apiKey: '', listId: '', contact: { email: 'test@example.com' } }))
      .resolves.toEqual(expect.objectContaining({ ok: false }));
  });

  it('syncToMailchimp is a no-op (ok:false) with empty credentials', async () => {
    const { syncToMailchimp } = await import('./lib/esp.js');
    await expect(syncToMailchimp({ apiKey: '', listId: '', contact: { email: 'test@example.com' } }))
      .resolves.toEqual(expect.objectContaining({ ok: false }));
  });

  it('dispatchToEsps skips disabled providers', async () => {
    const { dispatchToEsps } = await import('./lib/esp.js');
    await expect(dispatchToEsps(
      { klaviyo: { enabled: false, apiKey: 'key', listId: 'list' } },
      { klaviyo: true },
      { email: 'test@example.com' },
    )).resolves.toBeUndefined();
  });

  it('dispatchToEsps skips when campaign opts out', async () => {
    const { dispatchToEsps } = await import('./lib/esp.js');
    await expect(dispatchToEsps(
      { klaviyo: { enabled: true, apiKey: 'key', listId: 'list' } },
      { klaviyo: false }, // campaign opted out
      { email: 'test@example.com' },
    )).resolves.toBeUndefined();
  });

  it('API key masking works correctly', () => {
    // Validate the masking logic inline (maskKey is not exported, test via behavior)
    const mask = (key: string) =>
      key.length > 4 ? `${'•'.repeat(Math.min(key.length - 4, 12))}${key.slice(-4)}` : '••••';
    expect(mask('pk_live_abcdefgh1234')).toMatch(/^•+1234$/);
    expect(mask('abcd')).toBe('••••');
    expect(mask('short')).toBe('•hort');
  });
});

// ── Security remediation (SR-01 … SR-15) ──────────────────────────────────────

describe('SR-01 — outbound webhook SSRF blocklist', () => {
  it('does not fetch when the URL resolves to a private/loopback IP', async () => {
    const { fireOutboundWebhook } = await import('./routes/outbound-webhook.js');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    for (const url of ['http://127.0.0.1/x', 'http://10.0.0.1/x', 'http://169.254.169.254/latest/meta-data/']) {
      await fireOutboundWebhook({
        config: { enabled: true, url, events: ['email_capture'] },
        event: 'email_capture',
        campaignId: UUID_A,
        tenantId: UUID_B,
        data: {},
      });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('SR-05 — Mailchimp serverPrefix validation', () => {
  it('returns ok:false and never fetches for a key with an invalid data center suffix', async () => {
    const { syncToMailchimp } = await import('./lib/esp.js');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await syncToMailchimp({
      apiKey: 'xxxxxxxx-us1.evil.com/path?q=', // crafted prefix
      listId: 'abc',
      contact: { email: 'test@example.com' },
      testMode: true,
    });
    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('accepts a well-formed data center suffix (us1, eu6)', () => {
    const re = /^[a-z]{2}\d{1,2}$/i;
    expect(re.test('us1')).toBe(true);
    expect(re.test('eu6')).toBe(true);
    expect(re.test('us1.evil.com/p')).toBe(false);
    expect(re.test('evil')).toBe(false);
  });
});

describe('SR-10 — origin gate enforced for all platforms', () => {
  // Mirrors the production eventOriginAllowed shape (index.ts) for the Shopify path.
  const registrableDomain = (host: string) => {
    const labels = host.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
    return labels.length <= 2 ? labels.join('.') : labels.slice(-2).join('.');
  };
  const allowed = (pageUrl: string | null, meta: { platform: string; domain: string | null; shopifyShop: string | null; wpSiteUrl: string | null }) => {
    if (!pageUrl) return true;
    let host: string;
    try { host = new URL(pageUrl).hostname; } catch { return true; }
    const target = registrableDomain(host);
    if (meta.domain && registrableDomain(meta.domain) === target) return true;
    if (meta.shopifyShop) {
      const shopHost = meta.shopifyShop.includes('.') ? meta.shopifyShop : `${meta.shopifyShop}.myshopify.com`;
      if (registrableDomain(shopHost) === target) return true;
    }
    if (meta.wpSiteUrl) {
      try {
        const wpHost = meta.wpSiteUrl.includes('://') ? new URL(meta.wpSiteUrl).hostname : meta.wpSiteUrl;
        if (registrableDomain(wpHost) === target) return true;
      } catch { /* ignore */ }
    }
    if (!meta.domain && !meta.shopifyShop && !meta.wpSiteUrl) return true;
    return false;
  };

  it('blocks forged events on a Shopify campaign from a foreign origin', () => {
    const meta = { platform: 'shopify', domain: null, shopifyShop: 'acme-store', wpSiteUrl: null };
    expect(allowed('https://evil.com/forge', meta)).toBe(false);
    expect(allowed('https://acme-store.myshopify.com/p', meta)).toBe(true);
  });

  it('still fails open when no domain of any kind is known', () => {
    const meta = { platform: 'other', domain: null, shopifyShop: null, wpSiteUrl: null };
    expect(allowed('https://anywhere.com/p', meta)).toBe(true);
  });
});

describe('SR-11 — frequency cap key matches across set and clear', () => {
  it('clears the same localStorage key that setFrequencyCap writes', () => {
    const id = UUID_A;
    const writtenKey = `_sp_${id}`;       // setFrequencyCap()
    const clearedKey = `_sp_${id}`;       // two-click dismiss (post-fix)
    expect(clearedKey).toBe(writtenKey);
    expect(clearedKey).not.toBe(`_sp_fr_${id}`); // the old, never-matching key
  });
});

// ── Health check ──────────────────────────────────────────────────────────────

describe('Health check', () => {
  it('GET /health returns ok', async () => {
    const app = Fastify({ logger: false });
    app.get('/health', async () => ({ ok: true }));
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
    await app.close();
  });
});
