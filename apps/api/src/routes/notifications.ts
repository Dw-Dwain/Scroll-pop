import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, eq, isNull, desc, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { notifications, tenants } from '../db/schema.js';

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
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: { notificationPrefs: true },
    });
    const prefs = (tenant?.notificationPrefs ?? {}) as Record<string, unknown>;
    if (prefs['notif_channels_inapp'] === false) return; // in-app channel off
    if (prefs[n.type] === false) return;                 // this event type off
    await db.insert(notifications).values({
      tenantId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      href: n.href ?? null,
    });
  } catch {
    /* notifications are best-effort — never break the originating action */
  }
}

const PrefsBody = z.record(z.union([z.boolean(), z.string(), z.number()]));

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
