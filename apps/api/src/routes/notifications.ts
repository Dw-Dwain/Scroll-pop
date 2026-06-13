import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, eq, isNull, desc, sql } from 'drizzle-orm';
import { db, systemDb } from '../db/client.js';
import { notifications, tenants, tenantMembers, users } from '../db/schema.js';
import { sendEmail, emailEnabled } from '../lib/email.js';

/**
 * Create an in-app notification for a tenant, respecting the tenant's notification
 * preferences. Safe to call from anywhere (campaign status changes, usage alerts,
 * etc.) — it never throws into the caller's request path.
 *
 * Gating: skip if the in-app channel is off, or if this event type is explicitly
 * disabled. Unset prefs default to ON so notifications work out of the box.
 */
export async function emitNotification(
  tenantId: string,
  n: { type: string; title: string; body?: string; href?: string },
): Promise<void> {
  try {
    // Uses systemDb (RLS-bypass): emitNotification is fire-and-forget and may run after the
    // originating request's tenant connection is released, so it must not depend on it. It writes
    // only to the explicitly-passed tenantId. (C-1)
    const tenant = await systemDb.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: { notificationPrefs: true },
    });
    const prefs = (tenant?.notificationPrefs ?? {}) as Record<string, unknown>;
    if (prefs[n.type] === false) return;                 // this event type off entirely

    // In-app channel (on unless explicitly disabled).
    if (prefs['notif_channels_inapp'] !== false) {
      await systemDb.insert(notifications).values({
        tenantId,
        type: n.type,
        title: n.title,
        body: n.body ?? null,
        href: n.href ?? null,
      });
    }

    // Email channel — on unless explicitly disabled, and only does anything once
    // RESEND_API_KEY + RESEND_FROM are configured. Resolves the tenant owner's email.
    if (prefs['notif_channels_email'] !== false && emailEnabled()) {
      void sendNotificationEmail(tenantId, n);
    }
  } catch {
    /* notifications are best-effort — never break the originating action */
  }
}

const APP_URL = process.env['DASHBOARD_URL'] ?? 'https://dashboard.scrollpop.online';

/** Look up the tenant owner's email and send the notification as an email. Best-effort. */
async function sendNotificationEmail(
  tenantId: string,
  n: { type: string; title: string; body?: string; href?: string },
): Promise<void> {
  try {
    const [owner] = await systemDb
      .select({ email: users.email })
      .from(tenantMembers)
      .innerJoin(users, eq(users.id, tenantMembers.userId))
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.role, 'owner')))
      .limit(1);
    if (!owner?.email || owner.email.endsWith('@users.scrollpop.local')) return;

    const link = n.href ? `${APP_URL}${n.href}` : APP_URL;
    const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
    const html =
      `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">` +
      `<h2 style="font-size:18px;color:#111">${esc(n.title)}</h2>` +
      (n.body ? `<p style="font-size:14px;color:#444;line-height:1.6">${esc(n.body)}</p>` : '') +
      `<p style="margin-top:24px"><a href="${esc(link)}" style="background:#6366f1;color:#fff;` +
      `padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px">Open ScrollPop</a></p>` +
      `<p style="font-size:11px;color:#999;margin-top:24px">Manage email alerts in Settings → Notifications.</p>` +
      `</div>`;
    await sendEmail({ to: owner.email, subject: n.title, html, text: `${n.title}\n\n${n.body ?? ''}\n\n${link}` });
  } catch {
    /* best-effort */
  }
}

// Cookie-consent banner config (stored as a sibling key in the tenant prefs JSONB). Validated
// here so the snippet can trust shape/colors; unknown keys are stripped by the object schema.
const ConsentBannerSchema = z.object({
  enabled: z.boolean().optional(),
  message: z.string().max(500).optional(),
  acceptText: z.string().max(60).optional(),
  rejectText: z.string().max(60).optional(),
  policyUrl: z.union([z.string().url().max(2048), z.literal('')]).optional(),
  policyText: z.string().max(60).optional(),
  position: z.enum(['bottom', 'top']).optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// Notification prefs are a flat record of scalars, plus the optional structured consentBanner.
const PrefsBody = z.record(z.union([z.boolean(), z.string(), z.number(), ConsentBannerSchema]));

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/notifications — recent feed + unread count
  fastify.get('/notifications', async (request, reply) => {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.tenantId, request.tenantId))
      .orderBy(desc(notifications.createdAt))
      .limit(30);

    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.tenantId, request.tenantId), isNull(notifications.readAt)));

    return reply.send({ data: { items: rows, unread: count } });
  });

  // POST /api/v1/notifications/:id/read — mark one read
  fastify.post<{ Params: { id: string } }>('/notifications/:id/read', async (request, reply) => {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, request.params.id), eq(notifications.tenantId, request.tenantId)));
    return reply.send({ data: { ok: true } });
  });

  // POST /api/v1/notifications/read-all — mark all read
  fastify.post('/notifications/read-all', async (request, reply) => {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.tenantId, request.tenantId), isNull(notifications.readAt)));
    return reply.send({ data: { ok: true } });
  });

  // GET /api/v1/notification-prefs — tenant notification preferences
  fastify.get('/notification-prefs', async (request, reply) => {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, request.tenantId),
      columns: { notificationPrefs: true },
    });
    return reply.send({ data: tenant?.notificationPrefs ?? {} });
  });

  // PUT /api/v1/notification-prefs — merge + persist preferences
  fastify.put('/notification-prefs', async (request, reply) => {
    const incoming = PrefsBody.parse(request.body);
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, request.tenantId),
      columns: { notificationPrefs: true },
    });
    const merged = { ...((tenant?.notificationPrefs ?? {}) as Record<string, unknown>), ...incoming };
    await db
      .update(tenants)
      .set({ notificationPrefs: merged, updatedAt: new Date() })
      .where(eq(tenants.id, request.tenantId));
    return reply.send({ data: merged });
  });
};
