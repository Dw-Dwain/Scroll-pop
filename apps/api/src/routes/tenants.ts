import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { tenants } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// NOTE: `plan` is deliberately NOT updatable here — it is owned exclusively by the Stripe webhook
// and the super-admin route. Accepting it let any member self-elevate to a paid tier for free,
// bypassing Stripe (S2). Keep it out of this body.
const UpdateTenantBody = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const tenantRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/tenants
  fastify.get('/tenants', async (request, reply) => {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, request.tenantId),
    });

    if (!tenant) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
    }

    return reply.send({ data: [tenant] }); // Refine's useList expects an array
  });

  // PATCH /api/v1/tenants/:id — only ever mutates the CALLER'S OWN tenant (request.tenantId), never
  // the client-supplied :id. Keying the WHERE on params.id was a cross-tenant IDOR (S2).
  fastify.patch<{ Params: { id: string } }>('/tenants/:id', async (request, reply) => {
    const body = UpdateTenantBody.parse(request.body);

    const [updated] = await db
      .update(tenants)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, request.tenantId))
      .returning();

    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
    }

    return reply.send({ data: updated });
  });
};
