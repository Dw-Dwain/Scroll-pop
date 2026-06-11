import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { db, acquireTenantConnection, rlsActive, tenantScopeStorage } from '../db/client.js';
import { tenants, users, tenantMembers } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { getAuth, clerkClient } from '@clerk/fastify';

// ─── Access tiers ─────────────────────────────────────────────────────────────
// ADMIN_EMAIL   = platform super-admin (dwain3991@gmail.com). One account only.
//                 Gets unlimited plan + admin console access.
// novatise.com  = Novatise agency. All @novatise.com emails share ONE org tenant
//                 (org_novatise) and get unlimited agency plan, but no admin console.
const ADMIN_EMAIL       = process.env['ADMIN_EMAIL']?.toLowerCase() ?? '';
const NOVATISE_ORG_KEY  = 'org_novatise';
const NOVATISE_ORG_NAME = 'Novatise';

function isUnlimitedUser(email: string): boolean {
  const e = email.toLowerCase();
  return e === ADMIN_EMAIL || e.endsWith('@novatise.com');
}

function isNovatiseDomain(email: string): boolean {
  return email.toLowerCase().endsWith('@novatise.com');
}

// Confirm the user's PRIMARY Clerk email is verified AND matches the email we're about to
// grant elevated perks to. Clerk allows attaching unverified addresses, so without this an
// attacker could sign up with an unverified @novatise.com or admin email and inherit the
// agency/unlimited plan. Fails CLOSED (returns false) on any lookup error.
async function isVerifiedPrimaryEmail(
  clerkUserId: string,
  expectedEmail: string,
  prefetched?: Awaited<ReturnType<typeof clerkClient.users.getUser>> | null,
): Promise<boolean> {
  try {
    const cu = prefetched ?? (await clerkClient.users.getUser(clerkUserId));
    const primary =
      cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId) ?? cu.emailAddresses[0];
    return (
      !!primary &&
      primary.verification?.status === 'verified' &&
      primary.emailAddress.toLowerCase() === expectedEmail.toLowerCase()
    );
  } catch {
    return false;
  }
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
    // True for verified platform super-admin / @novatise.com users. Lets agency-only features
    // (client workspaces, team management) work even when the user's own tenant isn't on the
    // agency plan. Defaults to false; set on the elevated auth paths below.
    isUnlimited: boolean;
    // Releases the request's reserved RLS connection (set only when DB_RLS_ENFORCED). Called in
    // the onResponse/onError hooks below.
    rlsRelease?: () => void;
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

    request.isUnlimited = false; // overridden true on the verified-elevated paths below

    // Get Clerk session claims via getAuth helper
    const auth = getAuth(request);
    const hasClerkAuth = auth?.userId;
    const isDev = process.env['NODE_ENV'] !== 'production';

    if (isDev && !hasClerkAuth) {
      // Guard: refuse to bypass auth if the database URL points to a remote host.
      // This prevents the dev-mode bypass from silently activating on production
      // if NODE_ENV is unset or misconfigured.
      const dbUrl = process.env['DATABASE_URL'] ?? '';
      // Defence-in-depth (CTO-AUDIT Phase 4, Finding 9): a managed-provider host can NEVER be
      // treated as local, even if the URL somehow also contains "localhost". The bypass only
      // engages for a genuinely local Postgres.
      const looksRemote = /neon\.tech|supabase|amazonaws|render\.com|\.cloud\b/i.test(dbUrl);
      const isLocalDb = !looksRemote && (dbUrl === '' || dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1'));
      if (!isLocalDb) {
        throw new Error(
          'FATAL: dev-mode auth bypass is active but DATABASE_URL points to a remote database. ' +
          'Set NODE_ENV=production to disable the bypass.',
        );
      }

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

      // Auto-upgrade novatise.com / admin users to unlimited — only if their email is verified.
      if (isUnlimitedUser(user.email) && (await isVerifiedPrimaryEmail(clerkUserId, user.email))) {
        await ensureUnlimitedTenant(tenant.id);
        request.isUnlimited = true;
      }

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
    let clerkUser: Awaited<ReturnType<typeof clerkClient.users.getUser>> | null = null;

    if (!user) {
      const cu = await clerkClient.users.getUser(clerkUserId);
      clerkUser = cu;
      resolvedEmail =
        cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId)
          ?.emailAddress ??
        cu.emailAddresses[0]?.emailAddress ??
        `${clerkUserId}@users.scrollpop.local`;
      resolvedName =
        [cu.firstName, cu.lastName].filter(Boolean).join(' ') || null;

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

    // Elevated perks (Novatise agency plan, platform admin unlimited) require a verified email.
    // Only computed for elevated candidates to avoid a Clerk lookup on every normal request.
    const isElevatedCandidate = isUnlimitedUser(userEmail);
    const emailVerified =
      isElevatedCandidate && (await isVerifiedPrimaryEmail(clerkUserId, userEmail, clerkUser));
    request.isUnlimited = isElevatedCandidate && emailVerified;

    // ─── @novatise.com → shared Novatise org tenant ───────────────────────────
    // All Novatise emails share a single org rather than getting personal tenants.
    // Unverified @novatise.com emails fall through to a regular free personal tenant.
    if (isNovatiseDomain(userEmail) && emailVerified) {
      let novaTenant = await db.query.tenants.findFirst({
        where: and(eq(tenants.clerkOrgId, NOVATISE_ORG_KEY), isNull(tenants.deletedAt)),
      });
      if (!novaTenant) {
        // Revive on conflict: a previously soft-deleted shared org is restored rather than
        // leaving a returning member with no live tenant.
        const inserted = await db
          .insert(tenants)
          .values({ clerkOrgId: NOVATISE_ORG_KEY, name: NOVATISE_ORG_NAME, plan: 'agency', monthlyViewLimit: 2_000_000 })
          .onConflictDoUpdate({ target: tenants.clerkOrgId, set: { deletedAt: null, updatedAt: new Date() } })
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

    // ─── Invited employee → shared agency tenant (coupled login) ──────────────
    // If this user was added (via an accepted team invite) to an agency-plan tenant, that
    // shared workspace becomes their active tenant so the whole team sees the same data.
    // Prefer an owned tenant over a guest membership when the user belongs to several.
    const agencyMemberships = await db
      .select({ tenantId: tenantMembers.tenantId, role: tenantMembers.role })
      .from(tenantMembers)
      .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
      .where(and(
        eq(tenantMembers.userId, user.id),
        eq(tenants.plan, 'agency'),
        isNull(tenants.deletedAt),
      ));
    if (agencyMemberships.length > 0) {
      const preferred = agencyMemberships.find((m) => m.role === 'owner') ?? agencyMemberships[0]!;
      request.tenantId = preferred.tenantId;
      request.userId = user.id;
      request.memberRole = preferred.role;
      return;
    }

    // ─── Regular personal tenant ──────────────────────────────────────────────
    let tenant = await db.query.tenants.findFirst({
      where: and(eq(tenants.clerkOrgId, personalOrgKey), isNull(tenants.deletedAt)),
    });

    if (!tenant) {
      // Revive on conflict: if this user's personal tenant was soft-deleted (e.g. via the
      // user.deleted webhook) and they sign in again, restore it rather than 500-ing on the
      // unique clerkOrgId constraint or leaving them tenant-less.
      const inserted = await db
        .insert(tenants)
        .values({ clerkOrgId: personalOrgKey, name: resolvedName ?? userEmail, plan: 'free', monthlyViewLimit: 1000 })
        .onConflictDoUpdate({ target: tenants.clerkOrgId, set: { deletedAt: null, updatedAt: new Date() } })
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

    // Auto-upgrade admin account to unlimited — only with a verified email.
    if (isElevatedCandidate && emailVerified) await ensureUnlimitedTenant(tenant.id);

    request.tenantId = tenant.id;
    request.userId = user.id;
    request.memberRole = membership?.role ?? 'owner';
  });

  // ─── RLS tenant scope (C-1) ────────────────────────────────────────────────────
  // Wrap the WHOLE request in an AsyncLocalStorage scope via a callback-style onRequest hook:
  // `run(store, done)` runs the rest of the request inside the scope (enterWith does NOT propagate
  // across Fastify hooks — verified — but run() wrapping the continuation does). The store starts
  // empty (→ `db` proxy falls back to the system pool); the preHandler below fills in the tenant
  // connection once the tenant is resolved. Only engaged when enforcement is active.
  fastify.addHook('onRequest', (request: FastifyRequest, _reply, done) => {
    if (rlsActive()) tenantScopeStorage.run({}, done);
    else done();
  });
  // After the tenant is resolved (the main preHandler above ran first), reserve a tenant-pool
  // connection stamped with `app.current_tenant` and put it in the request's scope store so every
  // query in the handler is DB-enforced to this tenant. Fails open (null → stays on system pool).
  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    if (rlsActive() && request.tenantId) {
      const conn = await acquireTenantConnection(request.tenantId);
      if (conn) {
        const store = tenantScopeStorage.getStore();
        if (store) { store.db = conn.db; request.rlsRelease = conn.release; }
        else { conn.release(); } // no active scope (shouldn't happen) — don't leak the connection
      }
    }
  });
  // Release the reserved connection on every terminal outcome (idempotent).
  fastify.addHook('onResponse', async (request: FastifyRequest) => { request.rlsRelease?.(); });
  fastify.addHook('onError', async (request: FastifyRequest) => { request.rlsRelease?.(); });
  fastify.addHook('onTimeout', async (request: FastifyRequest) => { request.rlsRelease?.(); });
};

export const tenantContextPlugin = fp(tenantContextPluginImpl);
