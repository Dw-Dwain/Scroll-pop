/**
 * Per-campaign ESP opt-in configuration — P1-8/P1-9.
 * Operators enable/disable Klaviyo and Mailchimp per campaign.
 * Actual credentials are stored at the tenant level (see integrations.ts).
 */
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { campaigns } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';

const EspConfigBody = z.object({
  klaviyo:   z.boolean().optional(),
  mailchimp: z.boolean().optional(),
});

export const espConfigRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/campaigns/:id/esp-config
  fastify.get<{ Params: { id: string } }>('/campaigns/:id/esp-config', async (request, reply) => {
    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, request.params.id),
        eq(campaigns.tenantId, request.tenantId),
        isNull(campaigns.deletedAt),
      ),
      columns: { id: true, espConfig: true },
    });
    if (!campaign) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    return reply.send({ data: campaign.espConfig ?? {} });
  });

  // PUT /api/v1/campaigns/:id/esp-config
  fastify.put<{ Params: { id: string } }>('/campaigns/:id/esp-config', async (request, reply) => {
    const body = EspConfigBody.parse(request.body);

    // Merge with existing so partial updates don't erase other providers
    const existing = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, request.params.id),
        eq(campaigns.tenantId, request.tenantId),
        isNull(campaigns.deletedAt),
      ),
      columns: { espConfig: true },
    });
    if (!existing) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const merged = {
      ...(existing.espConfig as Record<string, unknown> ?? {}),
      ...(body.klaviyo   !== undefined ? { klaviyo: body.klaviyo }     : {}),
      ...(body.mailchimp !== undefined ? { mailchimp: body.mailchimp }  : {}),
    };

    const [updated] = await db
      .update(campaigns)
      .set({ espConfig: merged, updatedAt: new Date() })
      .where(and(
        eq(campaigns.id, request.params.id),
        eq(campaigns.tenantId, request.tenantId),
        isNull(campaigns.deletedAt),
      ))
      .returning({ id: campaigns.id, espConfig: campaigns.espConfig });

    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    return reply.send({ data: updated.espConfig });
  });
};
