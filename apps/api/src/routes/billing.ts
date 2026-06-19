import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { tenants, events } from '../db/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';
import Stripe from 'stripe';
import { PLAN_LIMITS, PLAN_PRICES_USD } from '@scrollpop/shared';
import { redis } from '../index.js';

function getStripe(): Stripe {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  // Pin the Stripe API version explicitly. We intentionally keep '2024-06-20' (the version this
  // billing/webhook code was written and tested against) even though the SDK now defaults to a
  // newer one — bumping the API version changes response/webhook shapes and must be done with
  // live testing, not a silent dependency bump. The cast satisfies the v22 SDK's narrowed type.
  return new Stripe(key, { apiVersion: '2024-06-20' as NonNullable<NonNullable<ConstructorParameters<typeof Stripe>[1]>['apiVersion']> });
}

// Allowlist the post-checkout redirect targets. Stripe will redirect the paying user to
// success_url / cancel_url — accepting an arbitrary URL lets an authenticated attacker craft
// a checkout link that lands victims on a phishing site (CTO-AUDIT Phase 4, Finding 4 / P1-2).
const isDev = process.env['NODE_ENV'] !== 'production';
const ALLOWED_REDIRECT_ORIGINS = new Set(
  [
    process.env['DASHBOARD_URL'],
    'https://dashboard.scrollpop.online',
    'https://scrollpop-dashboard.pages.dev',
    ...(isDev ? ['http://localhost:5173', 'http://localhost:3000'] : []),
  ].filter((o): o is string => Boolean(o)),
);
// Cloudflare Pages preview deploys: <hash>.scrollpop-dashboard.pages.dev
const PAGES_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.scrollpop-dashboard\.pages\.dev$/;

function isAllowedRedirect(url: string): boolean {
  try {
    const origin = new URL(url).origin;
    return ALLOWED_REDIRECT_ORIGINS.has(origin) || PAGES_PREVIEW_RE.test(origin);
  } catch {
    return false;
  }
}

const redirectUrl = z.string().url().refine(isAllowedRedirect, {
  message: 'URL origin is not an allowed ScrollPop dashboard origin',
});

const CheckoutBody = z.object({
  // `free` is a downgrade (handled via the Stripe portal), so the only checkout-able plan is `agency`.
  plan: z.enum(['agency']),
  successUrl: redirectUrl,
  cancelUrl: redirectUrl,
});

export const billingRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/billing/plans — available plans + current plan
  fastify.get('/billing/plans', async (request, reply) => {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, request.tenantId),
    });

    const plans = Object.entries(PLAN_LIMITS).map(([key, limits]) => ({
      id: key,
      priceUsd: PLAN_PRICES_USD[key as keyof typeof PLAN_PRICES_USD],
      monthlyViews: limits.monthlyViews,
      sites: limits.sites,
      showPoweredBy: limits.showPoweredBy,
      current: tenant?.plan === key,
    }));

    return reply.send({ data: { plans, currentPlan: tenant?.plan ?? 'free' } });
  });

  // POST /api/v1/billing/checkout — create Stripe Checkout session
  fastify.post('/billing/checkout', async (request, reply) => {
    const body = CheckoutBody.parse(request.body);
    const stripe = getStripe();

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, request.tenantId),
    });

    if (!tenant) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
    }

    const priceEnvKey = `STRIPE_PRICE_${body.plan.toUpperCase()}` as const;
    const priceId = process.env[priceEnvKey];

    if (!priceId) {
      return reply.code(500).send({
        error: { code: 'CONFIG_ERROR', message: `Stripe price not configured for plan: ${body.plan}` },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...(tenant.stripeCustomerId ? { customer: tenant.stripeCustomerId } : {}),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: body.successUrl,
      cancel_url: body.cancelUrl,
      metadata: { tenantId: tenant.id },
    });

    return reply.send({ data: { url: session.url } });
  });

  // POST /api/v1/billing/portal — create Stripe Customer Portal session
  fastify.post('/billing/portal', async (request, reply) => {
    const body = z.object({ returnUrl: redirectUrl }).parse(request.body);
    const stripe = getStripe();

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, request.tenantId),
    });

    if (!tenant?.stripeCustomerId) {
      return reply.code(400).send({
        error: { code: 'NO_SUBSCRIPTION', message: 'No Stripe customer found. Please subscribe first.' },
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: body.returnUrl,
    });

    return reply.send({ data: { url: session.url } });
  });

  // GET /api/v1/billing/usage — current month view count vs. limit
  fastify.get('/billing/usage', async (request, reply) => {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, request.tenantId),
    });

    if (!tenant) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
    }

    // Real monthly view count — Redis counter is the fast path, DB is fallback.
    let currentMonthViews = 0;
    const month = new Date().toISOString().slice(0, 7);
    const redisKey = `sp_views:${request.tenantId}:${month}`;

    if (redis) {
      try {
        currentMonthViews = (await redis.get<number>(redisKey)) ?? 0;
      } catch { /* fall through to DB */ }
    }

    if (currentMonthViews === 0) {
      try {
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const [row] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(events)
          .where(and(
            eq(events.tenantId, request.tenantId),
            eq(events.eventType, 'impression'),
            gte(events.ts, monthStart)
          ));
        currentMonthViews = row?.count ?? 0;
      } catch { /* return 0 on error */ }
    }

    return reply.send({
      data: {
        plan: tenant.plan,
        monthlyViewLimit: tenant.monthlyViewLimit,
        currentMonthViews,
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
      },
    });
  });
};
