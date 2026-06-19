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
// The super-admin console reads/writes ACROSS all tenants by design, so it uses the system
// (RLS-bypass) pool rather than the request's tenant-scoped connection. Access is still gated by
// assertSuperAdmin on every route. (C-1)
import { systemDb as db } from '../db/client.js';
import { users, tenants, tenantMembers, sites, campaigns, adminAuditLog } from '../db/schema.js';
import { eq, sql, isNull, and, like, inArray } from 'drizzle-orm';
import { clerkClient } from '@clerk/fastify';

const ADMIN_EMAIL = process.env['ADMIN_EMAIL']?.toLowerCase() ?? '';

// Per-route rate limit for the admin console — low enough to blunt brute-force / abuse,
// generous enough for normal console use (CTO-AUDIT Phase 4, Finding 12 / P2-19).
const adminRateLimit = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

/**
 * Record a super-admin action in the audit log (CTO-AUDIT Phase 4, Finding 8 / P2-4).
 * Best-effort — a logging failure must never break the privileged action itself.
 */
async function writeAudit(
  request: FastifyRequest,
  action: string,
  targetTenantId: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    const actor = await db.query.users.findFirst({
      where: eq(users.id, request.userId),
      columns: { email: true },
    });
    await db.insert(adminAuditLog).values({
      actorUserId: request.userId,
      actorEmail: actor?.email ?? null,
      action,
      targetTenantId,
      details,
    });
  } catch {
    /* best-effort */
  }
}

// Only the exact platform-owner email gets super-admin access.
// novatise.com users are a client agency — they get unlimited plan limits,
// but they do NOT have access to the admin console.
function isAdminUser(email: string): boolean {
  return ADMIN_EMAIL !== '' && email.toLowerCase() === ADMIN_EMAIL;
}

// Short-TTL cache of clerkUserIds that recently passed a LIVE Clerk primary-email verification.
// Lets the super-admin check fail CLOSED on a Clerk API error (H-1) without locking the owner
// out during a transient Clerk blip — but only if they verified successfully in the last 5 min.
const ADMIN_VERIFY_TTL_MS = 5 * 60 * 1000;
const recentlyVerifiedAdmins = new Map<string, number>();

/** Rejects the request if the calling user is not the super admin. */
async function assertSuperAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, request.userId),
    columns: { email: true, clerkUserId: true },
  });

  // Super-admin requires the DB email to match ADMIN_EMAIL. The DB email is populated by the
  // Clerk webhook from the user's own account, so it is NOT user-spoofable. On top of that we
  // re-check live with Clerk that the email is the verified primary — but if the Clerk API call
  // itself ERRORS (network blip, transient Clerk outage), we fall back to the DB-email match
  // rather than silently locking the owner out. An explicit "not verified / not primary" answer
  // from Clerk is still a denial.
  const emailMatches = !!user && isAdminUser(user.email);
  let verified = false;
  if (emailMatches) {
    const clerkUserId = user!.clerkUserId;
    try {
      const cu = await clerkClient.users.getUser(clerkUserId);
      const primary =
        cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId) ?? cu.emailAddresses[0];
      verified =
        !!primary &&
        primary.verification?.status === 'verified' &&
        primary.emailAddress.toLowerCase() === ADMIN_EMAIL;
      if (verified) {
        recentlyVerifiedAdmins.set(clerkUserId, Date.now() + ADMIN_VERIFY_TTL_MS);
      } else {
        // An explicit "not verified / not primary" answer from Clerk is a hard denial — and it
        // invalidates any cached pass so a downgraded account can't ride a stale entry.
        recentlyVerifiedAdmins.delete(clerkUserId);
        request.log.warn(
          { clerkUserId, status: primary?.verification?.status },
          '[admin] super-admin denied: Clerk primary email not verified/matching',
        );
      }
    } catch (err) {
      // FAIL CLOSED on a Clerk API error (H-1). Only allow if this exact user passed a LIVE
      // verification within the TTL window — never fall back to the DB email alone, which the
      // Clerk user.updated webhook can populate with an unverified address.
      const until = recentlyVerifiedAdmins.get(clerkUserId);
      if (until && until > Date.now()) {
        verified = true;
        request.log.warn({ clerkUserId }, '[admin] Clerk verification errored — honoring recent verified-cache entry');
      } else {
        request.log.error({ err: err instanceof Error ? err.message : 'error' }, '[admin] Clerk verification failed and no recent verified-cache entry — denying');
      }
    }
  }

  if (!verified) {
    request.log.warn(
      { userId: request.userId, hasUser: !!user, emailMatches, adminEmailConfigured: ADMIN_EMAIL !== '' },
      '[admin] super-admin check failed',
    );
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
  fastify.get('/admin/tenants', adminRateLimit, async (request, reply) => {
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

    // Attach the owner email/name for each tenant in ONE join (was 2 queries per tenant —
    // an N+1 that made the admin console slower with every tenant. CTO-AUDIT P2-8).
    const tenantIds = rows.map((t) => t.id);
    const members = tenantIds.length
      ? await db
          .select({
            tenantId: tenantMembers.tenantId,
            role: tenantMembers.role,
            email: users.email,
            name: users.name,
          })
          .from(tenantMembers)
          .innerJoin(users, eq(users.id, tenantMembers.userId))
          .where(inArray(tenantMembers.tenantId, tenantIds))
      : [];

    // Prefer the owner; fall back to any member (matches the prior arbitrary-first behaviour).
    const ownerByTenant = new Map<string, { email: string | null; name: string | null }>();
    for (const m of members) {
      const existing = ownerByTenant.get(m.tenantId);
      if (!existing || m.role === 'owner') {
        ownerByTenant.set(m.tenantId, { email: m.email, name: m.name });
      }
    }

    const enriched = rows.map((t) => {
      const o = ownerByTenant.get(t.id);
      return { ...t, email: o?.email ?? null, ownerName: o?.name ?? null };
    });

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
  }>('/admin/tenants/:id/plan', adminRateLimit, async (request, reply) => {
    if (!await assertSuperAdmin(request, reply)) return;

    const { plan, monthlyViewLimit } = request.body;
    const validPlans = ['free', 'agency'];
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
    await writeAudit(request, 'tenant.plan_change', request.params.id, { plan, monthlyViewLimit });
    return reply.send({ data: updated });
  });

  /**
   * DELETE /api/v1/admin/tenants/:id
   * Manually soft-delete a tenant (e.g. stale demo/orphaned row).
   * Super-admin only.
   */
  fastify.delete<{ Params: { id: string } }>('/admin/tenants/:id', adminRateLimit, async (request, reply) => {
    if (!await assertSuperAdmin(request, reply)) return;

    const [updated] = await db
      .update(tenants)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(tenants.id, request.params.id), isNull(tenants.deletedAt)))
      .returning({ id: tenants.id });

    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tenant not found or already deleted' } });
    }
    await writeAudit(request, 'tenant.delete', request.params.id, {});
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
  fastify.post('/admin/sync', adminRateLimit, async (request, reply) => {
    if (!await assertSuperAdmin(request, reply)) return;

    // Fetch ALL active users from Clerk, paginated — the old single 500-cap call silently
    // ignored users past the limit, so they'd never be reconciled (CTO-AUDIT Finding 10 / P3-8).
    const activeClerkIds = new Set<string>();
    const PAGE = 100;
    for (let offset = 0; ; offset += PAGE) {
      const page = await clerkClient.users.getUserList({ limit: PAGE, offset });
      for (const u of page.data) activeClerkIds.add(u.id);
      if (page.data.length < PAGE) break;
    }

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
    await writeAudit(request, 'admin.sync', null, { deletedUsers, deletedTenants });
    return reply.send({ data: { deletedUsers, deletedTenants, message: `Removed ${deletedUsers} stale users and ${deletedTenants} orphaned tenants` } });
  });

  /**
   * GET /api/v1/admin/stats
   * Platform-wide counts.  Super-admin only.
   */
  fastify.get('/admin/stats', adminRateLimit, async (request, reply) => {
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
