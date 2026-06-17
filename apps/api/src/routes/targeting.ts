import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { targetingRules, campaigns } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';

// Validate url_regex patterns for ReDoS safety.
// Rejects patterns with nested quantifiers that cause catastrophic backtracking,
// e.g. (a+)+, (a*b+)*, ([a-z]+)+ etc.
function validateRegexPattern(pattern: unknown): string | null {
  if (typeof pattern !== 'string') return 'Pattern must be a string';
  if (pattern.length === 0 || pattern.length > 100) return 'Pattern must be 1–100 characters';
  try {
    new RegExp(pattern);
  } catch {
    return 'Invalid regular expression';
  }
  // Block nested quantifiers: a group followed by + or * that itself contains + or *
  if (/\([^()]*[+*][^()]*\)[+*{]/.test(pattern)) {
    return 'Pattern contains nested quantifiers that may cause ReDoS';
  }
  return null;
}

const CreateTargetingBody = z.object({
  kind: z.enum(['url_exact', 'url_contains', 'url_regex', 'device', 'returning_visitor', 'geo', 'session_page_views', 'utm', 'ab_test']),
  operator: z.enum(['include', 'exclude']).default('include'),
  value: z.record(z.unknown()),
});

const UpdateTargetingBody = z.object({
  operator: z.enum(['include', 'exclude']).optional(),
  value: z.record(z.unknown()).optional(),
});

export const targetingRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/campaigns/:id/targeting
  fastify.get<{ Params: { id: string } }>('/campaigns/:id/targeting', async (request, reply) => {
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

    const rows = await db.query.targetingRules.findMany({
      where: and(
        eq(targetingRules.campaignId, request.params.id),
        eq(targetingRules.tenantId, request.tenantId)
      ),
    });

    return reply.send({ data: rows });
  });

  // POST /api/v1/campaigns/:id/targeting
  fastify.post<{ Params: { id: string } }>('/campaigns/:id/targeting', async (request, reply) => {
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

    const body = CreateTargetingBody.parse(request.body);

    if (body.kind === 'url_regex') {
      const err = validateRegexPattern((body.value as Record<string, unknown>)['pattern']);
      if (err) return reply.code(400).send({ error: { code: 'INVALID_REGEX', message: err } });
    }

    const [rule] = await db
      .insert(targetingRules)
      .values({
        campaignId: request.params.id,
        tenantId: request.tenantId,
        kind: body.kind,
        operator: body.operator,
        value: body.value,
      })
      .returning();

    return reply.code(201).send({ data: rule });
  });

  // PUT /api/v1/campaigns/:id/targeting
  fastify.put<{ Params: { id: string } }>('/campaigns/:id/targeting', async (request, reply) => {
    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, request.params.id), eq(campaigns.tenantId, request.tenantId), isNull(campaigns.deletedAt)),
    });

    if (!campaign) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const body = z.array(CreateTargetingBody).parse(request.body);

    for (const rule of body) {
      if (rule.kind === 'url_regex') {
        const err = validateRegexPattern((rule.value as Record<string, unknown>)['pattern']);
        if (err) return reply.code(400).send({ error: { code: 'INVALID_REGEX', message: err } });
      }
    }

    await db.delete(targetingRules).where(and(eq(targetingRules.campaignId, request.params.id), eq(targetingRules.tenantId, request.tenantId)));

    let newRules: any[] = [];
    if (body.length > 0) {
      newRules = await db.insert(targetingRules).values(body.map(t => ({
        campaignId: request.params.id,
        tenantId: request.tenantId,
        kind: t.kind,
        operator: t.operator,
        value: t.value,
      }))).returning();
    }
    return reply.send({ data: newRules });
  });

  // PATCH /api/v1/targeting/:id
  fastify.patch<{ Params: { id: string } }>('/targeting/:id', async (request, reply) => {
    const body = UpdateTargetingBody.parse(request.body);

    // S12: validate a url_regex pattern on update too. POST/PUT validate it, but PATCH previously
    // wrote body.value straight through — letting an operator store a ReDoS pattern (contained today
    // by the snippet's isSafeRegex backstop, but the storage gate should match). Look up the rule's
    // kind (tenant-scoped) and validate when a url_regex rule's value is being changed.
    if (body.value !== undefined) {
      const [existing] = await db
        .select({ kind: targetingRules.kind })
        .from(targetingRules)
        .where(and(eq(targetingRules.id, request.params.id), eq(targetingRules.tenantId, request.tenantId)))
        .limit(1);
      if (existing?.kind === 'url_regex') {
        const err = validateRegexPattern((body.value as Record<string, unknown>)['pattern']);
        if (err) return reply.code(400).send({ error: { code: 'INVALID_REGEX', message: err } });
      }
    }

    const [updated] = await db
      .update(targetingRules)
      .set({
        ...(body.operator !== undefined ? { operator: body.operator } : {}),
        ...(body.value !== undefined ? { value: body.value } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(targetingRules.id, request.params.id), eq(targetingRules.tenantId, request.tenantId)))
      .returning();

    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Targeting rule not found' } });
    }

    return reply.send({ data: updated });
  });

  // DELETE /api/v1/targeting/:id
  fastify.delete<{ Params: { id: string } }>('/targeting/:id', async (request, reply) => {
    const result = await db
      .delete(targetingRules)
      .where(and(eq(targetingRules.id, request.params.id), eq(targetingRules.tenantId, request.tenantId)))
      .returning();

    if (result.length === 0) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Targeting rule not found' } });
    }

    return reply.code(204).send();
  });
};
