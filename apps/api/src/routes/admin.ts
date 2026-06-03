/**
 * Super-admin routes — accessible ONLY to the account whose email matches
 * the ADMIN_EMAIL environment variable (defaults to dwain3991@gmail.com).
 *
 * Security model:
 *  1. Every request still passes through the standard Clerk JWT + tenant-context
 *     middleware, so the caller must be authenticated.
 *  2. On top of that, we look up the user's email in the DB and compare it to
 *     ADMIN_EMAIL.  No one can spoof this — the email is fetched server-side
 *     from our own users table (populated by the Clerk webhook on sign-up).
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client.js';
import { users, tenants, tenantMembers, sites, campaigns } from '../db/schema.js';
import { eq, sql, isNull, and, like } from 'drizzle-orm';
import { clerkClient } from '@clerk/fastify';

const ADMIN_EMAIL = process.env['ADMIN_EMAIL']?.toLowerCase() ?? '';

// Only the exact platform-owner email gets super-admin access.
// novatise.com users are a client agency — they get unlimited plan limits,
// but they do NOT have access to the admin console.
function isAdminUser(email: string): boolean {
  return ADMIN_EMAIL !== '' && email.toLowerCase() === ADMIN_EMAIL;
}

/** Rejects the request if the calling user is not the super admin. */
async function assertSuperAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, request.userId),
    columns: { email: true, clerkUserId: true },
  });

  // Super-admin requires BOTH the email match AND that the email is verified & primary in Clerk.
  // This closes the path where an unverified/secondary admin-looking email could grant console access.
  let verified = false;
  if (user && isAdminUser(user.email)) {
    try {
      const cu = await clerkClient.users.getUser(user.clerkUserId);
      const primary =
        cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId) ?? cu.emailAddresses[0];
      verified =
        !!primary &&
        primary.verification?.status === 'verified' &&
        primary.emailAddress.toLowerCase() === ADMIN_EMAIL;
    } catch {
      verified = false;
    }
  }

  if (!verified) {
    await reply.code(403).send({
      error: {
        code: 'FORBIDDEN',
        message: 'Super-admin access required.',
      },
    });
    return false;
  }
  return true;
}

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/admin/tenants
   * Returns all tenants with basic stats (sites, campaigns, plan).
   * Super-admin only.
   */
  fastify.get('/admin/tenants', async (request, reply) => {
    if (!await assertSuperAdmin(request, reply)) return;

    const rows = await db
      .select({
        id:              tenants.id,
        name:            tenants.name,
        plan:            tenants.plan,
        monthlyViewLimit: tenants.monthlyViewLimit,
        createdAt:       tenants.createdAt,
        deletedAt:       tenants.deletedAt,
        siteCount: sql<number>`(
          select count(*)::int from sites s
          where s.tenant_id = ${tenants.id} and s.deleted_at is null
        )`,
        campaignCount: sql<number>`(
          select count(*)::int from campaigns c
          where c.tenant_id = ${tenants.id} and c.deleted_at is null
        )`,
      })
      .from(tenants)
      .where(isNull(tenants.deletedAt))
      .orderBy(tenants.createdAt);

    // Attach the owner email for each tenant
    const enriched = await Promise.all(
      rows.map(async (t) => {
        const member = await db.query.tenantMembers.findFirst({
          where: eq(tenantMembers.tenantId, t.id),
          columns: { userId: true },
        });
        if (!member) return { ...t, email: null };
        const u = await db.query.users.findFirst({
          where: eq(users.id, member.userId),
          columns: { email: true, name: true },
        });
        return { ...t, email: u?.email ?? null, ownerName: u?.name ?? null };
      })
    );

    return reply.send({ data: enriched });
  });

  /**
   * PATCH /api/v1/admin/tenants/:id/plan
   * Change a tenant's plan (e.g. for manual upgrades / customer support).
   * Super-admin only.
   */
  fastify.patch<{
    Params: { id: string };
    Body: { plan: string; monthlyViewLimit?: number };
  }>('/admin/tenants/:id/plan', async (request, reply) => {
    if (!await assertSuperAdmin(request, reply)) return;

    const { plan, monthlyViewLimit } = request.body;
    const validPlans = ['free', 'starter', 'growth', 'scale', 'agency'];
    if (!validPlans.includes(plan)) {
      return reply.code(400).send({ error: { code: 'INVALID_PLAN', message: 'Invalid plan value' } });
    }

    const [updated] = await db
      .update(tenants)
      .set({
        plan: plan as typeof tenants.plan._.data,
        ...(monthlyViewLimit !== undefined ? { monthlyViewLimit } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, request.params.id))
      .returning();

    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
    }
    return reply.send({ data: updated });
  });

  /**
   * DELETE /api/v1/admin/tenants/:id
   * Manually soft-delete a tenant (e.g. stale demo/orphaned row).
   * Super-admin only.
   */
  fastify.delete<{ Params: { id: string } }>('/admin/tenants/:id', async (request, reply) => {
    if (!await assertSuperAdmin(request, reply)) return;

    const [updated] = await db
      .update(tenants)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(tenants.id, request.params.id), isNull(tenants.deletedAt)))
      .returning({ id: tenants.id });

    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tenant not found or already deleted' } });
    }
    return reply.code(204).send();
  });

  /**
   * POST /api/v1/admin/sync
   * Reconciles the DB with the live Clerk user list.
   * - Deletes user rows (+ their personal tenants) for Clerk-deleted users
   * - Soft-deletes orphaned personal tenants for @novatise.com users
   *   (they now share the org_novatise tenant instead)
   * Super-admin only.
   */
  fastify.post('/admin/sync', async (request, reply) => {
    if (!await assertSuperAdmin(request, reply)) return;

    // Fetch all active users from Clerk (up to 500 — enough for any early-stage app)
    const clerkResponse = await clerkClient.users.getUserList({ limit: 500 });
    const activeClerkIds = new Set(clerkResponse.data.map((u) => u.id));

    const allDbUsers = await db.query.users.findMany({ columns: { id: true, clerkUserId: true, email: true } });

    let deletedUsers = 0;
    let deletedTenants = 0;

    for (const dbUser of allDbUsers) {
      if (activeClerkIds.has(dbUser.clerkUserId)) continue;

      // User was deleted from Clerk — clean up DB
      await db.update(tenants)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(tenants.clerkOrgId, `personal_${dbUser.clerkUserId}`),
          isNull(tenants.deletedAt)
        ));

      await db.delete(tenantMembers).where(eq(tenantMembers.userId, dbUser.id));
      await db.delete(users).where(eq(users.id, dbUser.id));
      deletedUsers++;
      deletedTenants++;
    }

    // Soft-delete any leftover personal tenants owned by @novatise.com users.
    // These were created before the shared org_novatise tenant existed.
    const personalTenants = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(and(isNull(tenants.deletedAt), like(tenants.clerkOrgId, 'personal_%')));

    for (const t of personalTenants) {
      const member = await db.query.tenantMembers.findFirst({
        where: eq(tenantMembers.tenantId, t.id),
        columns: { userId: true },
      });
      if (!member) continue;
      const owner = await db.query.users.findFirst({
        where: eq(users.id, member.userId),
        columns: { email: true },
      });
      if (owner?.email.toLowerCase().endsWith('@novatise.com')) {
        await db.update(tenants)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(tenants.id, t.id));
        deletedTenants++;
      }
    }

    fastify.log.info({ deletedUsers, deletedTenants }, 'Admin Clerk sync completed');
    return reply.send({ data: { deletedUsers, deletedTenants, message: `Removed ${deletedUsers} stale users and ${deletedTenants} orphaned tenants` } });
  });

  /**
   * GET /api/v1/admin/stats
   * Platform-wide counts.  Super-admin only.
   */
  fastify.get('/admin/stats', async (request, reply) => {
    if (!await assertSuperAdmin(request, reply)) return;

    const [tenantsRes, sitesRes, campaignsRes] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(tenants).where(isNull(tenants.deletedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(sites).where(isNull(sites.deletedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(campaigns).where(isNull(campaigns.deletedAt)),
    ]);

    return reply.send({
      data: {
        tenants:   tenantsRes[0]?.count ?? 0,
        sites:     sitesRes[0]?.count ?? 0,
        campaigns: campaignsRes[0]?.count ?? 0,
      },
    });
  });
};
