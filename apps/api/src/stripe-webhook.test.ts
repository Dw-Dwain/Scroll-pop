/**
 * Stripe webhook signature verification — REAL SDK dry-run.
 *
 * The main integration suite (index.test.ts) MOCKS the `stripe` module, so the
 * actual signature-verification path has never been exercised. This file does NOT
 * mock stripe: it uses the real SDK to generate a valid signature and asserts the
 * handler accepts it and rejects forgeries.
 *
 * The headline test signs a RAW payload containing non-canonical whitespace. If the
 * handler fell back to `JSON.stringify(request.body)` (compact bytes) the signature
 * would not match — so a passing test proves `request.rawBody` is captured and used.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Stripe from 'stripe';

// ── Mocks for everything EXCEPT stripe (mirrors index.test.ts) ────────────────
vi.mock('./db/client.js', () => {
  const upd = (result: unknown[] = []) => {
    const mkw = () => { const p = Promise.resolve(result); return Object.assign({}, { returning: vi.fn().mockResolvedValue(result), then: p.then.bind(p), catch: p.catch.bind(p), finally: p.finally.bind(p) }); };
    return { set: vi.fn().mockReturnValue({ where: vi.fn().mockImplementation(mkw) }) };
  };
  const q = () => ({ findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) });
  return {
    db: {
      query: { sites: q(), campaigns: q(), tenants: q(), users: q(), tenantMembers: q() },
      update: vi.fn().mockImplementation(() => upd()),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn(), onConflictDoUpdate: vi.fn() }) }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    },
    sqlClient: { unsafe: vi.fn().mockResolvedValue(null) },
  };
});

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  })),
}));

vi.mock('@clerk/fastify', () => ({
  clerkPlugin: async (app: { decorate: (k: string, v: unknown) => void }) => { app.decorate('clerk', {}); },
  clerkClient: {
    sessions: { getSessionList: vi.fn().mockResolvedValue({ data: [] }), revokeSession: vi.fn().mockResolvedValue({}) },
    users: { getUser: vi.fn().mockResolvedValue({}), deleteUser: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock('./plugins/tenant-context.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenantContextPlugin: async (_app: any) => { /* webhooks are unauthenticated — no hook needed */ },
}));
vi.mock('./lib/sentry.js', () => ({ captureException: vi.fn(), sentryEnabled: vi.fn().mockReturnValue(false) }));
vi.mock('./lib/email.js', () => ({ sendEmail: vi.fn().mockResolvedValue(true), emailEnabled: vi.fn().mockReturnValue(false) }));
vi.mock('./lib/cache-purge.js', () => ({ purgeSiteConfigCache: vi.fn().mockResolvedValue(undefined) }));
vi.mock('svix', () => ({ Webhook: vi.fn().mockImplementation(() => ({ verify: vi.fn() })) }));

// webhooks.js imports `{ redis }` from ../index.js. Mock it so importing the route
// does NOT pull in the full server module (which runs bootstrap() + app.listen at
// import time — that would bind port 3001 and flake under parallel test workers).
vi.mock('./index.js', () => ({ redis: { del: vi.fn().mockResolvedValue(1) } }));

// ── Test secret + env (must be set before the handler reads process.env) ──────
const WEBHOOK_SECRET = 'whsec_test_dryrun_secret_value_1234567890';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost/test';
process.env['NODE_ENV'] = 'test';
process.env['REDIS_URL'] = 'https://test.upstash.io';
process.env['REDIS_TOKEN'] = 'test-token';
process.env['CLERK_SECRET_KEY'] = 'sk_test_placeholder';
process.env['CLERK_PUBLISHABLE_KEY'] = 'pk_test_placeholder';
process.env['STRIPE_SECRET_KEY'] = 'sk_test_placeholder';
process.env['STRIPE_WEBHOOK_SECRET'] = WEBHOOK_SECRET;

const stripe = new Stripe('sk_test_placeholder', { apiVersion: '2024-06-20' as NonNullable<NonNullable<ConstructorParameters<typeof Stripe>[1]>['apiVersion']> });

// Deliberately non-canonical formatting (indentation + newlines) so the raw bytes
// differ from JSON.stringify(parsed). An unhandled event type hits the `default`
// branch → received:true with no DB writes.
const RAW_PAYLOAD = `{
  "id":  "evt_dryrun_0001",
  "object": "event",
  "type":   "invoice.paid",
  "data": { "object": { "id": "in_test_0001" } }
}`;

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const { webhookRoutes } = await import('./routes/webhooks.js');
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  await app.ready();
  return app;
}

describe('Stripe webhook — real signature verification', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('accepts a correctly-signed event AND proves rawBody is used (non-canonical whitespace)', async () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload: RAW_PAYLOAD, secret: WEBHOOK_SECRET });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/stripe',
      headers: { 'content-type': 'application/json', 'stripe-signature': header },
      payload: RAW_PAYLOAD,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ received: true });
  });

  it('rejects a tampered body (signature no longer matches) with 400', async () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload: RAW_PAYLOAD, secret: WEBHOOK_SECRET });
    const tampered = RAW_PAYLOAD.replace('in_test_0001', 'in_ATTACKER_0001');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/stripe',
      headers: { 'content-type': 'application/json', 'stripe-signature': header },
      payload: tampered,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_SIGNATURE');
  });

  it('rejects a signature made with the wrong secret with 400', async () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload: RAW_PAYLOAD, secret: 'whsec_WRONG_secret' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/stripe',
      headers: { 'content-type': 'application/json', 'stripe-signature': header },
      payload: RAW_PAYLOAD,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_SIGNATURE');
  });

  it('rejects a missing signature header with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload: RAW_PAYLOAD,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_SIGNATURE');
  });
});
