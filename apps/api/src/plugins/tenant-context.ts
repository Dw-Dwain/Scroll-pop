import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { db } from '../db/client.js';
import { tenants, users, tenantMembers } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { getAuth } from '@clerk/fastify';

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
    if (authHeader && process.env['INTERNAL_SECRET'] && authHeader === `Bearer ${process.env['INTERNAL_SECRET']}`) {
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

    if (!clerkOrgId) {
      return reply.code(403).send({
        error: {
          code: 'NO_ORG',
          message: 'No organization selected. Please select an organization.',
        },
      });
    }

    // Resolve tenant
    const tenant = await db.query.tenants.findFirst({
      where: and(eq(tenants.clerkOrgId, clerkOrgId), isNull(tenants.deletedAt)),
    });

    if (!tenant) {
      return reply.code(403).send({
        error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' },
      });
    }

    // Resolve user
    const user = await db.query.users.findFirst({
      where: eq(users.clerkUserId, clerkUserId),
    });

    if (!user) {
      return reply.code(403).send({
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    // Resolve membership + role
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

    request.tenantId = tenant.id;
    request.userId = user.id;
    request.memberRole = membership.role;
  });
};

export const tenantContextPlugin = fp(tenantContextPluginImpl);
