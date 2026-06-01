import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client.js';
import { tenants, users, tenantMembers } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { getAuth, clerkClient } from '@clerk/fastify';

// ─── Access tiers ─────────────────────────────────────────────────────────────
// ADMIN_EMAIL   = platform super-admin (dwain3991@gmail.com). One account only.
//                 Gets unlimited plan + admin console access.
// novatise.com  = Novatise agency. All @novatise.com emails share ONE org tenant
//                 (org_novatise) and get unlimited agency plan, but no admin console.
const ADMIN_EMAIL       = (process.env['ADMIN_EMAIL'] ?? 'dwain3991@gmail.com').toLowerCase();
const NOVATISE_ORG_KEY  = 'org_novatise';
const NOVATISE_ORG_NAME = 'Novatise';

function isUnlimitedUser(email: string): boolean {
  const e = email.toLowerCase();
  return e === ADMIN_EMAIL || e.endsWith('@novatise.com');
}

function isNovatiseDomain(email: string): boolean {
  return email.toLowerCase().endsWith('@novatise.com');
}

async function ensureUnlimitedTenant(tenantId: string): Promise<void> {
  // Set to agency plan + 2M monthly view limit if not already there.
  // This is idempotent — safe to call on every request for these users.
  const t = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { plan: true, monthlyViewLimit: true },
  });
  if (t && (t.plan !== 'agency' || t.monthlyViewLimit < 2_000_000)) {
    await db.update(tenants)
      .set({ plan: 'agency', monthlyViewLimit: 2_000_000, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));
  }
}

// Extend FastifyRequest with tenant context
declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
    userId: string;
    memberRole: string;
  }
}

const PUBLIC_ROUTES = [
  '/health',
  '/api/v1/webhooks/clerk',
  '/api/v1/webhooks/stripe',
  '/api/v1/webhooks/shopify',
  '/api/v1/shopify/callback',   // Shopify OAuth redirect — verified by HMAC + nonce
  '/api/v1/internal',
  '/v1/',
  '/c/',
  '/e',
];

const tenantContextPluginImpl: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request: FastifyRequest, reply) => {
    // Skip public routes
    if (PUBLIC_ROUTES.some((r) => request.url.startsWith(r))) return;
    // Check for Internal Secret bypass (for Desktop Admin app)
    const authHeader = request.headers.authorization;
    const internalSecret = process.env['INTERNAL_SECRET'] || 'change_me_in_production_32_chars_min';
    if (authHeader && authHeader === `Bearer ${internalSecret}`) {
      const tenantOverride = request.headers['x-tenant-override'] as string | undefined;
      if (tenantOverride && tenantOverride.length === 36) {
        request.tenantId = tenantOverride;
      } else {
        // Create seed tenant if it doesn't exist
        let tenant = await db.query.tenants.findFirst({
          where: eq(tenants.clerkOrgId, 'org_demo_12345'),
        });
        if (!tenant) {
          const results = await db.insert(tenants).values({
            clerkOrgId: 'org_demo_12345',
            name: 'Demo Local Org',
            plan: 'free',
            monthlyViewLimit: 1000,
          }).returning();
          tenant = results[0];
        }
        if (!tenant) {
          throw new Error('Failed to create or retrieve demo tenant');
        }
        request.tenantId = tenant.id;
      }
      request.userId = 'admin_desktop_client';
      request.memberRole = 'admin';
      return;
    }

    // Get Clerk session claims via getAuth helper
    const auth = getAuth(request);
    const hasClerkAuth = auth?.userId;
    const isDev = process.env['NODE_ENV'] !== 'production';

    if (isDev && !hasClerkAuth) {
      // Create seed tenant if it doesn't exist
      let tenant = await db.query.tenants.findFirst({
        where: eq(tenants.clerkOrgId, 'org_demo_12345'),
      });
      if (!tenant) {
        const results = await db.insert(tenants).values({
          clerkOrgId: 'org_demo_12345',
          name: 'Demo Local Org',
          plan: 'free',
          monthlyViewLimit: 1000,
        }).returning();
        tenant = results[0];
      }

      if (!tenant) {
        throw new Error('Failed to retrieve or create seed tenant');
      }

      let user = await db.query.users.findFirst({
        where: eq(users.clerkUserId, 'user_demo_12345'),
      });
      if (!user) {
        const results = await db.insert(users).values({
          clerkUserId: 'user_demo_12345',
          email: 'demo@scrollpop.local',
          name: 'Demo Local User',
        }).returning();
        user = results[0];
      }

      if (!user) {
        throw new Error('Failed to retrieve or create seed user');
      }

      let membership = await db.query.tenantMembers.findFirst({
        where: and(
          eq(tenantMembers.tenantId, tenant.id),
          eq(tenantMembers.userId, user.id)
        ),
      });
      if (!membership) {
        const results = await db.insert(tenantMembers).values({
          tenantId: tenant.id,
          userId: user.id,
          role: 'owner',
        }).returning();
        membership = results[0];
      }

      if (!membership) {
        throw new Error('Failed to retrieve or create seed membership');
      }

      request.tenantId = tenant.id;
      request.userId = user.id;
      request.memberRole = membership.role;
      return;
    }

    if (!auth?.userId) {
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const clerkUserId = auth.userId;
    const clerkOrgId = auth.orgId;

    // ─── Org-scoped path (Clerk Organization active) ──────────────────────────
    if (clerkOrgId) {
      const tenant = await db.query.tenants.findFirst({
        where: and(eq(tenants.clerkOrgId, clerkOrgId), isNull(tenants.deletedAt)),
      });
      if (!tenant) {
        return reply.code(403).send({
          error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' },
        });
      }
      const user = await db.query.users.findFirst({
        where: eq(users.clerkUserId, clerkUserId),
      });
      if (!user) {
        return reply.code(403).send({
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }
      const membership = await db.query.tenantMembers.findFirst({
        where: and(
          eq(tenantMembers.tenantId, tenant.id),
          eq(tenantMembers.userId, user.id)
        ),
      });
      if (!membership) {
        return reply.code(403).send({
          error: { code: 'NOT_A_MEMBER', message: 'Not a member of this organization' },
        });
      }

      // Auto-upgrade novatise.com / admin users to unlimited
      if (isUnlimitedUser(user.email)) await ensureUnlimitedTenant(tenant.id);

      request.tenantId = tenant.id;
      request.userId = user.id;
      request.memberRole = membership.role;
      return;
    }

    // ─── Personal-account path (no Clerk org) ─────────────────────────────────
    const personalOrgKey = `personal_${clerkUserId}`;

    let user = await db.query.users.findFirst({
      where: eq(users.clerkUserId, clerkUserId),
    });

    // Resolve email early so we can route @novatise.com users to their shared org.
    let resolvedEmail: string | null = null;
    let resolvedName: string | null = null;

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      resolvedEmail =
        clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
          ?.emailAddress ??
        clerkUser.emailAddresses[0]?.emailAddress ??
        `${clerkUserId}@users.scrollpop.local`;
      resolvedName =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null;

      const inserted = await db
        .insert(users)
        .values({ clerkUserId, email: resolvedEmail, name: resolvedName })
        .onConflictDoUpdate({
          target: users.clerkUserId,
          set: { email: resolvedEmail, name: resolvedName, updatedAt: new Date() },
        })
        .returning();
      user = inserted[0];
    }

    if (!user) throw new Error('Failed to provision user');

    const userEmail = resolvedEmail ?? user.email;


    // ─── @novatise.com → shared Novatise org tenant ───────────────────────────
    // All Novatise emails share a single org rather than getting personal tenants.
    if (isNovatiseDomain(userEmail)) {
      let novaTenant = await db.query.tenants.findFirst({
        where: eq(tenants.clerkOrgId, NOVATISE_ORG_KEY),
      });
      if (!novaTenant) {
        const inserted = await db
          .insert(tenants)
          .values({ clerkOrgId: NOVATISE_ORG_KEY, name: NOVATISE_ORG_NAME, plan: 'agency', monthlyViewLimit: 2_000_000 })
          .onConflictDoNothing()
          .returning();
        novaTenant =
          inserted[0] ??
          (await db.query.tenants.findFirst({ where: eq(tenants.clerkOrgId, NOVATISE_ORG_KEY) }));
      }
      if (!novaTenant) throw new Error('Failed to provision Novatise tenant');

      let novaMembership = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.tenantId, novaTenant.id), eq(tenantMembers.userId, user.id)),
      });
      if (!novaMembership) {
        const inserted = await db
          .insert(tenantMembers)
          .values({ tenantId: novaTenant.id, userId: user.id, role: 'owner' })
          .onConflictDoNothing()
          .returning();
        novaMembership =
          inserted[0] ??
          (await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.tenantId, novaTenant.id), eq(tenantMembers.userId, user.id)),
          }));
      }

      request.tenantId = novaTenant.id;
      request.userId = user.id;
      request.memberRole = novaMembership?.role ?? 'owner';
      return;
    }

    // ─── Regular personal tenant ──────────────────────────────────────────────
    let tenant = await db.query.tenants.findFirst({
      where: eq(tenants.clerkOrgId, personalOrgKey),
    });

    if (!tenant) {
      const inserted = await db
        .insert(tenants)
        .values({ clerkOrgId: personalOrgKey, name: resolvedName ?? userEmail, plan: 'free', monthlyViewLimit: 1000 })
        .onConflictDoNothing()
        .returning();
      tenant =
        inserted[0] ??
        (await db.query.tenants.findFirst({ where: eq(tenants.clerkOrgId, personalOrgKey) }));
    }

    if (!tenant) throw new Error('Failed to provision personal tenant');

    let membership = await db.query.tenantMembers.findFirst({
      where: and(eq(tenantMembers.tenantId, tenant.id), eq(tenantMembers.userId, user.id)),
    });
    if (!membership) {
      const inserted = await db
        .insert(tenantMembers)
        .values({ tenantId: tenant.id, userId: user.id, role: 'owner' })
        .onConflictDoNothing()
        .returning();
      membership =
        inserted[0] ??
        (await db.query.tenantMembers.findFirst({
          where: and(eq(tenantMembers.tenantId, tenant.id), eq(tenantMembers.userId, user.id)),
        }));
    }

    // Auto-upgrade admin account to unlimited
    if (isUnlimitedUser(userEmail)) await ensureUnlimitedTenant(tenant.id);

    request.tenantId = tenant.id;
    request.userId = user.id;
    request.memberRole = membership?.role ?? 'owner';
  });
};

export const tenantContextPlugin = fp(tenantContextPluginImpl);
