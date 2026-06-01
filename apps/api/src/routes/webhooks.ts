import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/client.js';
import { tenants, users, tenantMembers, sites } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { Webhook } from 'svix';
import Stripe from 'stripe';
import { PLAN_LIMITS } from '@scrollpop/shared';
import { redis } from '../index.js';

// ─── Clerk Webhook ────────────────────────────────────────────────────────────

interface ClerkOrganizationEvent {
  type: string;
  data: {
    id: string;
    name: string;
    slug?: string;
  };
}

interface ClerkMembershipEvent {
  type: string;
  data: {
    organization: { id: string };
    public_user_data: {
      user_id: string;
      identifier: string;
      first_name?: string;
      last_name?: string;
    };
    role: string;
  };
}

interface ClerkUserEvent {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{ email_address: string }>;
    first_name?: string;
    last_name?: string;
  };
}

// ─── Stripe Webhook ───────────────────────────────────────────────────────────

/** Delete the KV edge-cache entries for all sites under a tenant so
 *  plan/limit changes propagate to the edge within one config TTL. */
async function bustTenantCache(tenantId: string): Promise<void> {
  if (!redis) return;
  try {
    const tenantSites = await db.query.sites.findMany({
      where: eq(sites.tenantId, tenantId),
      columns: { publicKey: true },
    });
    await Promise.allSettled(
      tenantSites.map((s) => redis!.del(`config:${s.publicKey}`))
    );
  } catch { /* non-fatal */ }
}

function getPlanFromStripePrice(priceId: string): 'starter' | 'growth' | 'scale' | 'agency' | null {
  if (priceId === process.env['STRIPE_PRICE_STARTER']) return 'starter';
  if (priceId === process.env['STRIPE_PRICE_GROWTH']) return 'growth';
  if (priceId === process.env['STRIPE_PRICE_SCALE']) return 'scale';
  if (priceId === process.env['STRIPE_PRICE_AGENCY']) return 'agency';
  return null;
}

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/webhooks/clerk
  fastify.post('/clerk', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const webhookSecret = process.env['CLERK_WEBHOOK_SECRET'];
    if (!webhookSecret) {
      fastify.log.warn('CLERK_WEBHOOK_SECRET not set — skipping webhook verification');
      return reply.code(400).send({ error: { code: 'CONFIG_ERROR', message: 'Webhook secret not configured' } });
    }

    // Verify Svix signature
    const wh = new Webhook(webhookSecret);
    let evt: ClerkOrganizationEvent | ClerkMembershipEvent | ClerkUserEvent;

    try {
      evt = wh.verify(
        JSON.stringify(request.body),
        {
          'svix-id': request.headers['svix-id'] as string,
          'svix-timestamp': request.headers['svix-timestamp'] as string,
          'svix-signature': request.headers['svix-signature'] as string,
        }
      ) as ClerkOrganizationEvent | ClerkMembershipEvent | ClerkUserEvent;
    } catch (err) {
      fastify.log.warn({ err }, 'Clerk webhook signature verification failed');
      return reply.code(400).send({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature invalid' } });
    }

    try {
      switch (evt.type) {
        case 'organization.created': {
          const data = (evt as ClerkOrganizationEvent).data;
          await db.insert(tenants).values({
            clerkOrgId: data.id,
            name: data.name,
            plan: 'free',
            monthlyViewLimit: PLAN_LIMITS.free.monthlyViews,
          }).onConflictDoNothing();
          break;
        }

        case 'organization.updated': {
          const data = (evt as ClerkOrganizationEvent).data;
          await db.update(tenants)
            .set({ name: data.name, updatedAt: new Date() })
            .where(eq(tenants.clerkOrgId, data.id));
          break;
        }

        case 'user.created':
        case 'user.updated': {
          const data = (evt as ClerkUserEvent).data;
          const email = data.email_addresses[0]?.email_address ?? '';
          const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null;

          await db.insert(users)
            .values({ clerkUserId: data.id, email, name })
            .onConflictDoUpdate({
              target: users.clerkUserId,
              set: { email, name, updatedAt: new Date() },
            });
          break;
        }

        case 'user.deleted': {
          const data = (evt as ClerkUserEvent).data;

          const user = await db.query.users.findFirst({
            where: eq(users.clerkUserId, data.id),
          });
          if (!user) break; // never provisioned or already cleaned up

          // Soft-delete their personal tenant so it disappears from the admin panel.
          await db.update(tenants)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(tenants.clerkOrgId, `personal_${data.id}`));

          // Remove all org memberships (junction rows — not business data).
          await db.delete(tenantMembers).where(eq(tenantMembers.userId, user.id));

          // Hard-delete the user row (users table has no deletedAt).
          // tenantMembers cascade-deletes automatically via FK, but we already cleared above.
          await db.delete(users).where(eq(users.id, user.id));

          fastify.log.info({ clerkUserId: data.id }, 'User deleted from Clerk — DB cleaned up');
          break;
        }

        case 'organizationMembership.created': {
          const data = (evt as ClerkMembershipEvent).data;

          const tenant = await db.query.tenants.findFirst({
            where: eq(tenants.clerkOrgId, data.organization.id),
          });
          const user = await db.query.users.findFirst({
            where: eq(users.clerkUserId, data.public_user_data.user_id),
          });

          if (tenant && user) {
            const role = data.role === 'org:admin' ? 'admin' : 'editor';
            await db.insert(tenantMembers)
              .values({ tenantId: tenant.id, userId: user.id, role })
              .onConflictDoNothing();
          }
          break;
        }

        case 'organizationMembership.deleted': {
          const data = (evt as ClerkMembershipEvent).data;
          const tenant = await db.query.tenants.findFirst({
            where: eq(tenants.clerkOrgId, data.organization.id),
          });
          const user = await db.query.users.findFirst({
            where: eq(users.clerkUserId, data.public_user_data.user_id),
          });

          if (tenant && user) {
            await db.delete(tenantMembers).where(
              and(
                eq(tenantMembers.tenantId, tenant.id),
                eq(tenantMembers.userId, user.id)
              )
            );
          }
          break;
        }

        default:
          fastify.log.info(`Unhandled Clerk event type: ${evt.type}`);
      }
    } catch (err) {
      fastify.log.error({ err }, 'Error processing Clerk webhook');
      return reply.code(500).send({ error: { code: 'PROCESSING_ERROR', message: 'Failed to process webhook' } });
    }

    return reply.send({ received: true });
  });

  // POST /api/v1/webhooks/stripe
  fastify.post('/stripe', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
    const stripeKey = process.env['STRIPE_SECRET_KEY'];

    if (!webhookSecret || !stripeKey) {
      return reply.code(400).send({ error: { code: 'CONFIG_ERROR', message: 'Stripe not configured' } });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        JSON.stringify(request.body),
        request.headers['stripe-signature'] as string,
        webhookSecret
      );
    } catch (err) {
      fastify.log.warn({ err }, 'Stripe webhook signature verification failed');
      return reply.code(400).send({ error: { code: 'INVALID_SIGNATURE', message: 'Stripe signature invalid' } });
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const tenantId = session.metadata?.['tenantId'];
          if (!tenantId || !session.customer || !session.subscription) break;

          await db.update(tenants)
            .set({
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              updatedAt: new Date(),
            })
            .where(eq(tenants.id, tenantId));
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.created': {
          const sub = event.data.object as Stripe.Subscription;
          const priceId = sub.items.data[0]?.price?.id;
          if (!priceId) break;

          const plan = getPlanFromStripePrice(priceId);
          if (!plan) break;

          const [updated] = await db.update(tenants)
            .set({
              plan,
              monthlyViewLimit: PLAN_LIMITS[plan].monthlyViews,
              stripeSubscriptionId: sub.id,
              updatedAt: new Date(),
            })
            .where(eq(tenants.stripeCustomerId, sub.customer as string))
            .returning({ id: tenants.id });

          // Bust edge KV cache so new limits take effect immediately.
          if (updated) await bustTenantCache(updated.id);
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const [downgraded] = await db.update(tenants)
            .set({
              plan: 'free',
              monthlyViewLimit: PLAN_LIMITS.free.monthlyViews,
              stripeSubscriptionId: null,
              updatedAt: new Date(),
            })
            .where(eq(tenants.stripeCustomerId, sub.customer as string))
            .returning({ id: tenants.id });

          if (downgraded) await bustTenantCache(downgraded.id);
          break;
        }

        default:
          fastify.log.info(`Unhandled Stripe event: ${event.type}`);
      }
    } catch (err) {
      fastify.log.error({ err }, 'Error processing Stripe webhook');
      return reply.code(500).send({ error: { code: 'PROCESSING_ERROR', message: 'Failed to process webhook' } });
    }

    return reply.send({ received: true });
  });
};
