import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { TriggerParamsSchema } from '@scrollpop/shared';
import { db } from '../db/client.js';
import { triggers, campaigns } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';

const CreateTriggerBody = z.object({
  // NOTE: back_button_capture is NOT a valid type. See CLAUDE.md rule #1.
  type: z.enum(['scroll_pct', 'dwell_time', 'inactivity', 'exit_intent_mouse', 'click']),
  params: z.record(z.unknown()).default({}),
});

const UpdateTriggerBody = z.object({
  params: z.record(z.unknown()),
});

async function assertCampaignOwnership(
  campaignId: string,
  tenantId: string,
  reply: FastifyReply
): Promise<boolean> {
  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.tenantId, tenantId),
      isNull(campaigns.deletedAt)
    ),
  });

  if (!campaign) {
    await reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    return false;
  }
  return true;
}

export const triggerRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/campaigns/:id/triggers
  fastify.get<{ Params: { id: string } }>('/campaigns/:id/triggers', async (request, reply) => {
    const ok = await assertCampaignOwnership(request.params.id, request.tenantId, reply);
    if (!ok) return;

    const rows = await db.query.triggers.findMany({
      where: and(
        eq(triggers.campaignId, request.params.id),
        eq(triggers.tenantId, request.tenantId)
      ),
    });

    return reply.send({ data: rows });
  });

  // POST /api/v1/campaigns/:id/triggers
  fastify.post<{ Params: { id: string } }>('/campaigns/:id/triggers', async (request, reply) => {
    const ok = await assertCampaignOwnership(request.params.id, request.tenantId, reply);
    if (!ok) return;

    const body = CreateTriggerBody.parse(request.body);

    // Validate trigger params match the type
    TriggerParamsSchema.parse({ type: body.type, ...body.params });

    const [trigger] = await db
      .insert(triggers)
      .values({
        campaignId: request.params.id,
        tenantId: request.tenantId,
        type: body.type,
        params: body.params,
      })
      .returning();

    return reply.code(201).send({ data: trigger });
  });

  // PUT /api/v1/campaigns/:id/triggers
  fastify.put<{ Params: { id: string } }>('/campaigns/:id/triggers', async (request, reply) => {
    const ok = await assertCampaignOwnership(request.params.id, request.tenantId, reply);
    if (!ok) return;

    const body = z.array(CreateTriggerBody).parse(request.body);
    for (const item of body) {
      TriggerParamsSchema.parse({ type: item.type, ...item.params });
    }

    await db.delete(triggers).where(and(eq(triggers.campaignId, request.params.id), eq(triggers.tenantId, request.tenantId)));

    let newTriggers: (typeof triggers.$inferSelect)[] = [];
    if (body.length > 0) {
      newTriggers = await db.insert(triggers).values(body.map(t => ({
        campaignId: request.params.id,
        tenantId: request.tenantId,
        type: t.type,
        params: t.params,
      }))).returning();
    }
    return reply.send({ data: newTriggers });
  });

  // PATCH /api/v1/triggers/:id
  fastify.patch<{ Params: { id: string } }>('/triggers/:id', async (request, reply) => {
    const body = UpdateTriggerBody.parse(request.body);

    const [updated] = await db
      .update(triggers)
      .set({ params: body.params, updatedAt: new Date() })
      .where(and(eq(triggers.id, request.params.id), eq(triggers.tenantId, request.tenantId)))
      .returning();

    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Trigger not found' } });
    }

    return reply.send({ data: updated });
  });

  // DELETE /api/v1/triggers/:id
  fastify.delete<{ Params: { id: string } }>('/triggers/:id', async (request, reply) => {
    const result = await db
      .delete(triggers)
      .where(and(eq(triggers.id, request.params.id), eq(triggers.tenantId, request.tenantId)))
      .returning();

    if (result.length === 0) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Trigger not found' } });
    }

    return reply.code(204).send();
  });
};
