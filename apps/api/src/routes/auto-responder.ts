import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { campaigns } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';

const AutoResponderBody = z.object({
  enabled: z.boolean(),
  subject: z.string().max(200).optional(),
  htmlBody: z.string().max(50000).optional(),
  replyTo: z.string().email().optional().or(z.literal('')),
});

export const autoResponderRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/campaigns/:id/auto-responder
  fastify.get<{ Params: { id: string } }>('/campaigns/:id/auto-responder', async (request, reply) => {
    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, request.params.id),
        eq(campaigns.tenantId, request.tenantId),
        isNull(campaigns.deletedAt),
      ),
      columns: { id: true, autoResponder: true },
    });
    if (!campaign) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    return reply.send({ data: campaign.autoResponder ?? {} });
  });

  // PUT /api/v1/campaigns/:id/auto-responder
  fastify.put<{ Params: { id: string } }>('/campaigns/:id/auto-responder', async (request, reply) => {
    const body = AutoResponderBody.parse(request.body);
    const [updated] = await db
      .update(campaigns)
      .set({ autoResponder: body, updatedAt: new Date() })
      .where(and(
        eq(campaigns.id, request.params.id),
        eq(campaigns.tenantId, request.tenantId),
        isNull(campaigns.deletedAt),
      ))
      .returning({ id: campaigns.id, autoResponder: campaigns.autoResponder });
    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    return reply.send({ data: updated.autoResponder });
  });
};
