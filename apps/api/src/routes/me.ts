import type { FastifyPluginAsync } from 'fastify';
// Uses the system pool (RLS-bypass): /me operates on the global `users` table and, for account
// deletion, must see the user's memberships ACROSS all tenants (the sole-owner check) — both of
// which a tenant-scoped RLS connection would hide. Queries are self-scoped by request.userId /
// request.tenantId at the app layer. (C-1)
import { systemDb as db } from '../db/client.js';
import { users, tenants, tenantMembers } from '../db/schema.js';
import { eq, and, isNull, not, like, sql as drizzleSql } from 'drizzle-orm';
import { clerkClient } from '@clerk/fastify';
import { revokeAllUserSessions } from '../lib/auth.js';

export const meRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/me — returns current user + tenant context
  fastify.get('/me', async (request, reply) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, request.userId),
    });

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, request.tenantId),
    });

    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.tenantId, request.tenantId),
        eq(tenantMembers.userId, request.userId)
      ),
    });

    if (!user || !tenant || !membership) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: 'User or tenant not found' },
      });
    }

    return reply.send({
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          plan: tenant.plan,
          monthlyViewLimit: tenant.monthlyViewLimit,
        },
        role: membership.role,
      },
    });
  });

  // DELETE /api/v1/me — self-service account deletion. Revokes all active Clerk sessions
  // immediately so any stolen token is invalidated before the DB row is removed (P3-4).
  fastify.delete('/me', async (request, reply) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, request.userId),
    });
    if (!user) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    // SR-03: block deletion if the user is the sole owner of any shared org — otherwise
    // that org is left permanently ownerless with no recovery path. Personal tenants
    // (clerkOrgId `personal_…`) are excluded; they're cleaned up below.
    const ownedTenants = await db
      .select({ tenantId: tenantMembers.tenantId, orgId: tenants.clerkOrgId })
      .from(tenantMembers)
      .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
      .where(and(
        eq(tenantMembers.userId, user.id),
        eq(tenantMembers.role, 'owner'),
        isNull(tenants.deletedAt),
        not(like(tenants.clerkOrgId, 'personal_%')),
      ));

    for (const t of ownedTenants) {
      const otherOwners = await db
        .select({ count: drizzleSql<number>`count(*)::int` })
        .from(tenantMembers)
        .where(and(
          eq(tenantMembers.tenantId, t.tenantId),
          eq(tenantMembers.role, 'owner'),
          not(eq(tenantMembers.userId, user.id)),
        ));
      if ((otherOwners[0]?.count ?? 0) === 0) {
        return reply.code(409).send({
          error: {
            code: 'SOLE_OWNER',
            message: `You are the only owner of org "${t.orgId}". Transfer ownership before deleting your account.`,
          },
        });
      }
    }

    // Revoke sessions before any destructive op — ensures the caller cannot retry with
    // the same JWT (shared helper, SR-15).
    await revokeAllUserSessions(user.clerkUserId, request.log);

    // SR-04: delete from Clerk FIRST. If we deleted the DB row first and the Clerk call
    // then failed/crashed, the Clerk user would survive with no DB row — next login would
    // mint a new UUID and orphan all prior data. Only touch the DB once Clerk confirms.
    try {
      await clerkClient.users.deleteUser(user.clerkUserId);
    } catch (err) {
      request.log.error({ err }, '[me] Clerk user deletion failed — aborting account delete');
      return reply.code(502).send({ error: { code: 'CLERK_ERROR', message: 'Failed to delete account from auth provider' } });
    }

    // DB cleanup only after Clerk confirms deletion. The user.deleted webhook will also
    // fire and re-run this cleanup — all operations are idempotent (WHERE clauses match
    // nothing on the second pass).
    await db.update(tenants)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(tenants.clerkOrgId, `personal_${user.clerkUserId}`));
    await db.delete(tenantMembers).where(eq(tenantMembers.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));

    return reply.code(204).send();
  });
};
