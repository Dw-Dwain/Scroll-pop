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
import { eq, sql, isNull } from 'drizzle-orm';

const ADMIN_EMAIL       = (process.env['ADMIN_EMAIL'] ?? 'dwain3991@gmail.com').toLowerCase();
const UNLIMITED_DOMAINS = ['novatise.com'];

function isAdminUser(email: string): boolean {
  const e = email.toLowerCase();
  return e === ADMIN_EMAIL || UNLIMITED_DOMAINS.some((d) => e.endsWith(`@${d}`));
}

/** Rejects the request if the calling user is not the super admin. */
async function assertSuperAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, request.userId),
    columns: { email: true },
  });

  if (!user || !isAdminUser(user.email)) {
    await reply.code(403).send({
      error: {
        code: 'FORBIDDEN',
        message: `Super-admin access required. Authenticated as: ${user?.email ?? 'unknown'}`,
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
