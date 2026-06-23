import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
// Team-invite flows are inherently CROSS-TENANT: an invitee accepting joins a *different* tenant
// than their current one, so the invite/membership rows can't be read/written under the accepting
// user's tenant-scoped RLS connection. Use the system (bypass) pool — every query here still
// filters explicitly by tenantId/email, and write paths re-verify the user's email. (C-1)
import { systemDb as db } from '../db/client.js';
import { teamInvites, tenantMembers, tenants, users } from '../db/schema.js';
import { eq, and, isNull, or, gt } from 'drizzle-orm';
import { clerkClient } from '@clerk/fastify';
import { sendEmail } from '../lib/email.js';

const DASHBOARD_URL = process.env['DASHBOARD_URL'] ?? 'https://dashboard.scrollpop.online';
// Invites expire 7 days after they're issued (or re-issued). Bounds the window in which a stale or
// mis-sent invite (recycled mailbox, former employee) can be redeemed into an agency tenant.
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// A SQL predicate for "not expired": legacy invites have NULL expires_at and stay valid.
const notExpired = () => or(isNull(teamInvites.expiresAt), gt(teamInvites.expiresAt, new Date()));
const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const InviteBody = z.object({
  email: z.string().email().max(254),
  role: z.enum(['admin', 'editor', 'viewer']).default('editor'),
});

/** Agency-plan check for the current tenant. */
async function isAgencyTenant(tenantId: string): Promise<boolean> {
  const t = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId), columns: { plan: true } });
  return t?.plan === 'agency';
}

/** Owner/admin + agency-plan gate for managing the team. */
async function requireOwner(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (!(await isAgencyTenant(request.tenantId)) && !request.isUnlimited) {
    void reply.code(403).send({ error: { code: 'AGENCY_ONLY', message: 'Team management is an Agency-plan feature.' } });
    return false;
  }
  if (request.memberRole !== 'owner' && request.memberRole !== 'admin') {
    void reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Only the agency owner can manage the team.' } });
    return false;
  }
  return true;
}

/** Verify the Clerk user's PRIMARY email is verified and equals the expected address. Fails closed. */
async function verifyPrimaryEmail(clerkUserId: string, expected: string): Promise<boolean> {
  try {
    const cu = await clerkClient.users.getUser(clerkUserId);
    const primary = cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId) ?? cu.emailAddresses[0];
    return (
      !!primary &&
      primary.verification?.status === 'verified' &&
      primary.emailAddress.toLowerCase() === expected.toLowerCase()
    );
  } catch {
    return false;
  }
}

export const teamRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /team — members + pending invites for the current agency tenant. Any member may view.
  fastify.get('/team', async (request, reply) => {
    if (!(await isAgencyTenant(request.tenantId))) {
      return reply.send({ data: { members: [], invites: [], isAgency: false } });
    }
    const members = await db
      .select({ userId: tenantMembers.userId, role: tenantMembers.role, email: users.email, name: users.name, createdAt: tenantMembers.createdAt })
      .from(tenantMembers)
      .innerJoin(users, eq(users.id, tenantMembers.userId))
      .where(eq(tenantMembers.tenantId, request.tenantId));
    const invites = await db.query.teamInvites.findMany({
      where: and(eq(teamInvites.tenantId, request.tenantId), eq(teamInvites.status, 'pending')),
      orderBy: (i, { desc }) => [desc(i.createdAt)],
    });
    return reply.send({
      data: {
        isAgency: true,
        members: members.map((m) => ({ ...m, isSelf: m.userId === request.userId })),
        invites,
      },
    });
  });

  // GET /public/invite-info/:id — PUBLIC (no auth): minimal context for the accept-invite deep
  // link so the page can say "you've been invited to X as Y; sign in with <email> to accept".
  // The invite id is an unguessable UUID emailed only to the invitee, so this is a capability-style
  // link — returning the target email + tenant name to whoever holds the id is acceptable, and the
  // accept endpoint still re-verifies the signed-in user's verified email matches. 404s for
  // unknown / non-pending invites (and for invites whose tenant was deleted).
  // NOTE: relies on `/api/v1/public/` being in tenant-context PUBLIC_ROUTES (skips auth).
  fastify.get<{ Params: { id: string } }>('/public/invite-info/:id', async (request, reply) => {
    const row = await db
      .select({ id: teamInvites.id, role: teamInvites.role, email: teamInvites.email, status: teamInvites.status, tenantName: tenants.name })
      .from(teamInvites)
      .innerJoin(tenants, eq(tenants.id, teamInvites.tenantId))
      .where(and(eq(teamInvites.id, request.params.id), isNull(tenants.deletedAt), notExpired()))
      .limit(1);
    const inv = row[0];
    if (!inv || inv.status !== 'pending') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Invite not found or no longer pending.' } });
    }
    return reply.send({ data: { id: inv.id, role: inv.role, email: inv.email, tenantName: inv.tenantName } });
  });

  // POST /team/invites — owner invites an employee by email.
  fastify.post('/team/invites', async (request, reply) => {
    if (!(await requireOwner(request, reply))) return;
    const { email, role } = InviteBody.parse(request.body);
    const normalized = email.trim().toLowerCase();

    // Already a member? (email synced from Clerk on tenant_members.user → users.email)
    const existing = await db
      .select({ userId: tenantMembers.userId })
      .from(tenantMembers)
      .innerJoin(users, eq(users.id, tenantMembers.userId))
      .where(and(eq(tenantMembers.tenantId, request.tenantId), eq(users.email, normalized)))
      .limit(1);
    if (existing[0]) {
      return reply.code(409).send({ error: { code: 'ALREADY_MEMBER', message: 'That person is already on your team.' } });
    }

    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const [invite] = await db
      .insert(teamInvites)
      .values({ tenantId: request.tenantId, email: normalized, role, invitedByUserId: request.userId, status: 'pending', expiresAt })
      .onConflictDoUpdate({
        target: [teamInvites.tenantId, teamInvites.email],
        // Re-inviting refreshes the expiry too, so a revived invite gets a fresh 7-day window.
        set: { role, status: 'pending', invitedByUserId: request.userId, acceptedUserId: null, acceptedAt: null, updatedAt: new Date(), expiresAt },
      })
      .returning();
    if (!invite) {
      return reply.code(500).send({ error: { code: 'INVITE_FAILED', message: 'Could not create the invite.' } });
    }

    // Notify the invitee by email (best-effort; dormant until Resend is configured, never blocks
    // the invite). The email deep-links to /accept-invite?invite=<id>; the accept itself is still
    // email-match based (the accepting user's verified email must equal the invited address).
    try {
      const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, request.tenantId), columns: { name: true } });
      const agencyName = escapeHtml(tenant?.name || 'a ScrollPop workspace');
      const roleEsc = escapeHtml(role);
      const toEsc = escapeHtml(normalized);
      // Deep-link straight to the accept page, carrying the invite id. The page tells them which
      // email to use, lets them sign up / sign in with it (prefilled), and accepts on the way in —
      // so acceptance no longer depends on them landing on the dashboard already signed in as the
      // exact invited address (which silently showed no banner before).
      const acceptUrl = `${DASHBOARD_URL}/accept-invite?invite=${invite.id}`;
      await sendEmail({
        to: normalized,
        subject: `You're invited to join ${tenant?.name || 'a ScrollPop workspace'} on ScrollPop`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:480px">
          <h2 style="margin:0 0 12px">You've been invited to ScrollPop</h2>
          <p>You're invited to join <strong>${agencyName}</strong> as a <strong>${roleEsc}</strong>.</p>
          <p style="margin:0 0 16px"><a href="${acceptUrl}"
             style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">
             Accept invitation</a></p>
          <p>This invite is tied to <strong>${toEsc}</strong> — accept it while signed in (or after creating an account) with that exact address.</p>
          <p style="color:#888;font-size:12px;margin-top:20px">If you weren't expecting this, you can safely ignore this email.<br>
             Button not working? Open <a href="${acceptUrl}">${acceptUrl}</a></p>
        </div>`,
        text: `You're invited to join ${tenant?.name || 'a ScrollPop workspace'} as a ${role} on ScrollPop.\n\nAccept here (sign in or sign up with ${normalized}): ${acceptUrl}`,
      });
    } catch { /* email is best-effort — the in-app PendingInvites banner is the source of truth */ }

    return reply.code(201).send({ data: invite });
  });

  // DELETE /team/invites/:id — owner revokes a pending invite.
  fastify.delete<{ Params: { id: string } }>('/team/invites/:id', async (request, reply) => {
    if (!(await requireOwner(request, reply))) return;
    const [revoked] = await db
      .delete(teamInvites)
      .where(and(eq(teamInvites.id, request.params.id), eq(teamInvites.tenantId, request.tenantId)))
      .returning();
    if (!revoked) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Invite not found' } });
    return reply.code(200).send({ data: revoked });
  });

  // DELETE /team/members/:userId — owner removes a team member (reverts them to their own account).
  fastify.delete<{ Params: { userId: string } }>('/team/members/:userId', async (request, reply) => {
    if (!(await requireOwner(request, reply))) return;
    if (request.params.userId === request.userId) {
      return reply.code(400).send({ error: { code: 'CANNOT_REMOVE_SELF', message: 'You cannot remove yourself.' } });
    }
    const target = await db.query.tenantMembers.findFirst({
      where: and(eq(tenantMembers.tenantId, request.tenantId), eq(tenantMembers.userId, request.params.userId)),
    });
    if (!target) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Member not found' } });
    if (target.role === 'owner') {
      return reply.code(403).send({ error: { code: 'CANNOT_REMOVE_OWNER', message: 'Owners cannot be removed.' } });
    }
    await db.delete(tenantMembers).where(and(eq(tenantMembers.tenantId, request.tenantId), eq(tenantMembers.userId, request.params.userId)));
    return reply.code(200).send({ data: { userId: request.params.userId } });
  });

  // GET /team/pending — pending invites addressed to the SIGNED-IN user (for the accept banner).
  fastify.get('/team/pending', async (request, reply) => {
    const me = await db.query.users.findFirst({ where: eq(users.id, request.userId), columns: { email: true } });
    if (!me) return reply.send({ data: [] });
    const rows = await db
      .select({ id: teamInvites.id, role: teamInvites.role, tenantId: teamInvites.tenantId, tenantName: tenants.name, createdAt: teamInvites.createdAt })
      .from(teamInvites)
      .innerJoin(tenants, eq(tenants.id, teamInvites.tenantId))
      .where(and(eq(teamInvites.email, me.email.toLowerCase()), eq(teamInvites.status, 'pending'), isNull(tenants.deletedAt), notExpired()));
    return reply.send({ data: rows });
  });

  // POST /team/invites/:id/accept — signed-in user joins the agency tenant (coupled login).
  fastify.post<{ Params: { id: string } }>('/team/invites/:id/accept', async (request, reply) => {
    const invite = await db.query.teamInvites.findFirst({ where: eq(teamInvites.id, request.params.id) });
    if (!invite || invite.status !== 'pending') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Invite not found or no longer pending.' } });
    }
    // Expired invites can't be redeemed (legacy NULL-expiry invites stay valid). The owner can
    // re-issue (POST /team/invites) to mint a fresh 7-day invite.
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      return reply.code(404).send({ error: { code: 'INVITE_EXPIRED', message: 'This invitation has expired. Ask the workspace owner to send a new one.' } });
    }
    const me = await db.query.users.findFirst({ where: eq(users.id, request.userId), columns: { email: true, clerkUserId: true } });
    if (!me) return reply.code(403).send({ error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });

    // The invite email MUST be the accepting user's verified primary email (fails closed).
    if (me.email.toLowerCase() !== invite.email.toLowerCase() || !(await verifyPrimaryEmail(me.clerkUserId, invite.email))) {
      return reply.code(403).send({ error: { code: 'EMAIL_MISMATCH', message: 'This invite was sent to a different (or unverified) email address.' } });
    }

    await db
      .insert(tenantMembers)
      .values({ tenantId: invite.tenantId, userId: request.userId, role: invite.role })
      .onConflictDoNothing();
    await db
      .update(teamInvites)
      .set({ status: 'accepted', acceptedUserId: request.userId, acceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(teamInvites.id, invite.id));

    return reply.code(200).send({ data: { tenantId: invite.tenantId, role: invite.role } });
  });

  // POST /team/invites/:id/decline — signed-in user declines an invite addressed to them.
  fastify.post<{ Params: { id: string } }>('/team/invites/:id/decline', async (request, reply) => {
    const invite = await db.query.teamInvites.findFirst({ where: eq(teamInvites.id, request.params.id) });
    if (!invite || invite.status !== 'pending') return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Invite not found.' } });
    const me = await db.query.users.findFirst({ where: eq(users.id, request.userId), columns: { email: true } });
    if (!me || me.email.toLowerCase() !== invite.email.toLowerCase()) {
      return reply.code(403).send({ error: { code: 'EMAIL_MISMATCH', message: 'Not your invite.' } });
    }
    await db.update(teamInvites).set({ status: 'revoked', updatedAt: new Date() }).where(eq(teamInvites.id, invite.id));
    return reply.code(200).send({ data: { id: invite.id } });
  });
};
