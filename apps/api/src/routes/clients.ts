import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { clients, sites, tenants } from '../db/schema.js';
import { eq, and, isNull, sql } from 'drizzle-orm';

const NameBody = z.object({ name: z.string().min(1).max(100) });

/** Agency-plan + owner/admin gate for client management (create/rename/delete). */
async function requireAgencyOwner(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, request.tenantId),
    columns: { plan: true },
  });
  if (tenant?.plan !== 'agency' && !request.isUnlimited) {
    void reply.code(403).send({ error: { code: 'AGENCY_ONLY', message: 'Client workspaces are an Agency-plan feature.' } });
    return false;
  }
  if (request.memberRole !== 'owner' && request.memberRole !== 'admin') {
    void reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Only the agency owner can manage clients.' } });
    return false;
  }
  return true;
}

export const clientRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/clients — list this agency's clients (+ site counts). Any member can read.
  fastify.get('/clients', async (request, reply) => {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, request.tenantId),
      columns: { plan: true },
    });
    if (tenant?.plan !== 'agency' && !request.isUnlimited) return reply.send({ data: [] }); // non-agency tenants have no clients
    const rows = await db.query.clients.findMany({
      where: and(eq(clients.tenantId, request.tenantId), isNull(clients.deletedAt)),
      orderBy: (c, { asc }) => [asc(c.name)],
    });
    const counts = await db
      .select({ clientId: sites.clientId, count: sql<number>`count(*)::int` })
      .from(sites)
      .where(and(eq(sites.tenantId, request.tenantId), isNull(sites.deletedAt)))
      .groupBy(sites.clientId);
    const countMap = new Map(counts.map((c) => [c.clientId, c.count]));
    return reply.send({ data: rows.map((c) => ({ ...c, siteCount: countMap.get(c.id) ?? 0 })) });
  });

  // POST /api/v1/clients — create a client workspace.
  fastify.post('/clients', async (request, reply) => {
    if (!(await requireAgencyOwner(request, reply))) return;
    const { name } = NameBody.parse(request.body);
    const [created] = await db.insert(clients).values({ tenantId: request.tenantId, name: name.trim() }).returning();
    return reply.code(201).send({ data: created });
  });

  // PATCH /api/v1/clients/:id — rename.
  fastify.patch<{ Params: { id: string } }>('/clients/:id', async (request, reply) => {
    if (!(await requireAgencyOwner(request, reply))) return;
    const { name } = NameBody.parse(request.body);
    const [updated] = await db
      .update(clients)
      .set({ name: name.trim(), updatedAt: new Date() })
      .where(and(eq(clients.id, request.params.id), eq(clients.tenantId, request.tenantId)))
      .returning();
    if (!updated) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Client not found' } });
    return reply.send({ data: updated });
  });

  // DELETE /api/v1/clients/:id — soft-delete; its sites become agency-level (client_id NULL).
  fastify.delete<{ Params: { id: string } }>('/clients/:id', async (request, reply) => {
    if (!(await requireAgencyOwner(request, reply))) return;
    const [deleted] = await db
      .update(clients)
      .set({ deletedAt: new Date() })
      .where(and(eq(clients.id, request.params.id), eq(clients.tenantId, request.tenantId)))
      .returning();
    if (!deleted) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Client not found' } });
    await db
      .update(sites)
      .set({ clientId: null })
      .where(and(eq(sites.clientId, request.params.id), eq(sites.tenantId, request.tenantId)));
    return reply.code(200).send({ data: deleted });
  });
};
