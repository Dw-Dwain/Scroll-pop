import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { coupons, campaigns } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'node:crypto';

const GenerateBody = z.object({
  campaignId: z.string().uuid().optional(),
  count: z.number().int().min(1).max(500).default(10),
  prefix: z.string().max(20).default('SAVE'),
  discountPct: z.number().int().min(1).max(100).optional(),
  discountAmtCents: z.number().int().min(0).optional(),
  maxUses: z.number().int().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
});

const ListQuery = z.object({
  campaignId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

function generateCode(prefix: string): string {
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${suffix}`;
}

export const couponRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/coupons/generate — bulk-generate unique codes
  fastify.post('/coupons/generate', async (request, reply) => {
    const body = GenerateBody.parse(request.body);

    // If campaignId provided, verify it belongs to this tenant
    if (body.campaignId) {
      const campaign = await db.query.campaigns.findFirst({
        where: and(eq(campaigns.id, body.campaignId), eq(campaigns.tenantId, request.tenantId)),
        columns: { id: true },
      });
      if (!campaign) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
      }
    }

    const rows = [];
    const attempted = new Set<string>();
    for (let i = 0; i < body.count; i++) {
      let code: string;
      // Guard against (rare) collision within this batch
      do { code = generateCode(body.prefix); } while (attempted.has(code));
      attempted.add(code);
      rows.push({
        tenantId: request.tenantId,
        campaignId: body.campaignId ?? null,
        code,
        discountPct: body.discountPct ?? null,
        discountAmtCents: body.discountAmtCents ?? null,
        maxUses: body.maxUses ?? null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      });
    }

    // Insert, ignoring duplicates with existing tenant codes
    const inserted = await db
      .insert(coupons)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: coupons.id, code: coupons.code });

    return reply.code(201).send({ data: inserted, meta: { generated: inserted.length, requested: body.count } });
  });

  // GET /api/v1/coupons — list tenant's coupon codes
  fastify.get('/coupons', async (request, reply) => {
    const q = ListQuery.parse(request.query);
    const where = and(
      eq(coupons.tenantId, request.tenantId),
      q.campaignId ? eq(coupons.campaignId, q.campaignId) : undefined,
    );

    const rows = await db
      .select()
      .from(coupons)
      .where(where)
      .orderBy(desc(coupons.createdAt))
      .limit(q.limit)
      .offset(q.offset);

    return reply.send({ data: rows });
  });

  // DELETE /api/v1/coupons/:id — remove a specific coupon
  fastify.delete<{ Params: { id: string } }>('/coupons/:id', async (request, reply) => {
    const [deleted] = await db
      .delete(coupons)
      .where(and(eq(coupons.id, request.params.id), eq(coupons.tenantId, request.tenantId)))
      .returning({ id: coupons.id });
    if (!deleted) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Coupon not found' } });
    }
    return reply.code(204).send();
  });
};
