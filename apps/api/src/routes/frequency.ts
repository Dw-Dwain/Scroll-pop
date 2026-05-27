import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { campaigns, frequencyRules } from '../db/schema.js';

const UpsertFrequencyBody = z.object({
  frequency: z.enum(['once_per_session', 'once_per_day', 'once_per_visitor', 'always']),
});

export const frequencyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>('/campaigns/:id/frequency', async (request, reply) => {
    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, request.params.id), eq(campaigns.tenantId, request.tenantId), isNull(campaigns.deletedAt)),
    });

    if (!campaign) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const row = await db.query.frequencyRules.findFirst({
      where: and(eq(frequencyRules.campaignId, request.params.id), eq(frequencyRules.tenantId, request.tenantId)),
    });

    return reply.send({ data: row ?? { campaignId: request.params.id, frequency: 'once_per_session' } });
  });

  const upsertHandler = async (request: any, reply: any) => {
    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, request.params.id), eq(campaigns.tenantId, request.tenantId), isNull(campaigns.deletedAt)),
    });

    if (!campaign) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const body = UpsertFrequencyBody.parse(request.body);

    const existing = await db.query.frequencyRules.findFirst({
      where: and(eq(frequencyRules.campaignId, request.params.id), eq(frequencyRules.tenantId, request.tenantId)),
    });

    if (!existing) {
      const [created] = await db
        .insert(frequencyRules)
        .values({
          campaignId: request.params.id,
          tenantId: request.tenantId,
          frequency: body.frequency,
        })
        .returning();

      return reply.code(201).send({ data: created });
    }

    const [updated] = await db
      .update(frequencyRules)
      .set({ frequency: body.frequency })
      .where(and(eq(frequencyRules.id, existing.id), eq(frequencyRules.tenantId, request.tenantId)))
      .returning();

    return reply.send({ data: updated });
  };

  fastify.post<{ Params: { id: string } }>('/campaigns/:id/frequency', upsertHandler);
  fastify.put<{ Params: { id: string } }>('/campaigns/:id/frequency', upsertHandler);
};
