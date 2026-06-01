import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { campaigns, sites, designs } from '../db/schema.js';
import { eq, and, isNull, desc } from 'drizzle-orm';

const CreateCampaignBody = z.object({
  siteId: z.string().uuid(),
  name: z.string().min(1).max(200),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

const UpdateCampaignBody = z.object({
  name: z.string().min(1).max(200).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export const campaignRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/campaigns
  fastify.get<{ Querystring: { siteId?: string; status?: string } }>(
    '/campaigns',
    async (request, reply) => {
      const { siteId, status } = request.query;

      const rows = await db
        .select({
          id: campaigns.id,
          tenantId: campaigns.tenantId,
          siteId: campaigns.siteId,
          name: campaigns.name,
          status: campaigns.status,
          startsAt: campaigns.startsAt,
          endsAt: campaigns.endsAt,
          createdAt: campaigns.createdAt,
          updatedAt: campaigns.updatedAt,
          deletedAt: campaigns.deletedAt,
          design: designs.config,
          kind: designs.kind,
        })
        .from(campaigns)
        .leftJoin(designs, eq(designs.campaignId, campaigns.id))
        .where(
          and(
            eq(campaigns.tenantId, request.tenantId),
            isNull(campaigns.deletedAt),
            siteId ? eq(campaigns.siteId, siteId) : undefined,
            status ? eq(campaigns.status, status as typeof campaigns.status._.data) : undefined
          )
        )
        .orderBy(desc(campaigns.createdAt));

      return reply.send({ data: rows });
    }
  );

  // POST /api/v1/campaigns
  fastify.post('/campaigns', async (request, reply) => {
    const body = CreateCampaignBody.parse(request.body);

    // Verify the site belongs to this tenant
    const site = await db.query.sites.findFirst({
      where: and(
        eq(sites.id, body.siteId),
        eq(sites.tenantId, request.tenantId),
        isNull(sites.deletedAt)
      ),
    });

    if (!site) {
      return reply.code(404).send({
        error: { code: 'SITE_NOT_FOUND', message: 'Site not found' },
      });
    }

    const [campaign] = await db
      .insert(campaigns)
      .values({
        tenantId: request.tenantId,
        siteId: body.siteId,
        name: body.name,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      })
      .returning();

    return reply.code(201).send({ data: campaign });
  });

  // GET /api/v1/campaigns/:id
  fastify.get<{ Params: { id: string } }>('/campaigns/:id', async (request, reply) => {
    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, request.params.id),
        eq(campaigns.tenantId, request.tenantId),
        isNull(campaigns.deletedAt)
      ),
    });

    if (!campaign) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    return reply.send({ data: campaign });
  });

  // PATCH /api/v1/campaigns/:id
  fastify.patch<{ Params: { id: string } }>('/campaigns/:id', async (request, reply) => {
    const body = UpdateCampaignBody.parse(request.body);

    const updateSet: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updateSet['name'] = body.name;
    if (body.startsAt !== undefined) updateSet['startsAt'] = body.startsAt ? new Date(body.startsAt) : null;
    if (body.endsAt !== undefined) updateSet['endsAt'] = body.endsAt ? new Date(body.endsAt) : null;

    const [updated] = await db
      .update(campaigns)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(updateSet as any)
      .where(and(eq(campaigns.id, request.params.id), eq(campaigns.tenantId, request.tenantId)))
      .returning();

    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    return reply.send({ data: updated });
  });

  // DELETE /api/v1/campaigns/:id (soft delete)
  fastify.delete<{ Params: { id: string } }>('/campaigns/:id', async (request, reply) => {
    const [deleted] = await db
      .update(campaigns)
      .set({ deletedAt: new Date() })
      .where(and(eq(campaigns.id, request.params.id), eq(campaigns.tenantId, request.tenantId)))
      .returning();

    if (!deleted) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    return reply.code(200).send({ data: deleted });
  });

  // POST & PATCH /api/v1/campaigns/:id/activate
  const handleActivate = async (request: any, reply: any) => {
    const [updated] = await db
      .update(campaigns)
      .set({ status: 'active', updatedAt: new Date() })
      .where(
        and(
          eq(campaigns.id, request.params.id),
          eq(campaigns.tenantId, request.tenantId),
          isNull(campaigns.deletedAt)
        )
      )
      .returning();

    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    // TODO: Publish config to Cloudflare KV (Step 5)
    return reply.send({ data: updated });
  };

  fastify.post<{ Params: { id: string } }>('/campaigns/:id/activate', handleActivate);
  fastify.patch<{ Params: { id: string } }>('/campaigns/:id/activate', handleActivate);

  // POST & PATCH /api/v1/campaigns/:id/pause
  const handlePause = async (request: any, reply: any) => {
    const [updated] = await db
      .update(campaigns)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(
        and(
          eq(campaigns.id, request.params.id),
          eq(campaigns.tenantId, request.tenantId),
          isNull(campaigns.deletedAt)
        )
      )
      .returning();

    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    // TODO: Update KV cache (Step 5)
    return reply.send({ data: updated });
  };

  fastify.post<{ Params: { id: string } }>('/campaigns/:id/pause', handlePause);
  fastify.patch<{ Params: { id: string } }>('/campaigns/:id/pause', handlePause);
};

