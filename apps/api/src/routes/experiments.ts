import type { FastifyPluginAsync } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'node:crypto';
import { db } from '../db/client.js';
import { campaigns, designs } from '../db/schema.js';

const CreateExperimentBody = z.object({
  name: z.string().min(1).max(200),
  allocation: z.record(z.unknown()).optional(),
  guardrails: z.record(z.unknown()).optional(),
});

const UpdateExperimentBody = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'running', 'paused', 'completed']).optional(),
  allocation: z.record(z.unknown()).optional(),
  guardrails: z.record(z.unknown()).optional(),
  result: z.record(z.unknown()).optional(),
});

type ExperimentRecord = {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  allocation: Record<string, unknown>;
  guardrails: Record<string, unknown>;
  result: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export const experimentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>('/campaigns/:id/experiments', async (request, reply) => {
    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, request.params.id), eq(campaigns.tenantId, request.tenantId), isNull(campaigns.deletedAt)),
    });
    if (!campaign) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });

    const design = await db.query.designs.findFirst({
      where: and(eq(designs.campaignId, request.params.id), eq(designs.tenantId, request.tenantId)),
    });
    const config = ((design?.config ?? {}) as Record<string, any>);
    const experiments = Array.isArray(config.experimentsV1) ? config.experimentsV1 : [];
    return reply.send({ data: experiments });
  });

  fastify.post<{ Params: { id: string } }>('/campaigns/:id/experiments', async (request, reply) => {
    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, request.params.id), eq(campaigns.tenantId, request.tenantId), isNull(campaigns.deletedAt)),
    });
    if (!campaign) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });

    const body = CreateExperimentBody.parse(request.body);
    const design = await db.query.designs.findFirst({
      where: and(eq(designs.campaignId, request.params.id), eq(designs.tenantId, request.tenantId)),
    });
    if (!design) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Design not found' } });

    const config = ((design.config ?? {}) as Record<string, any>);
    const experiments = (Array.isArray(config.experimentsV1) ? config.experimentsV1 : []) as ExperimentRecord[];
    const now = new Date().toISOString();
    const created: ExperimentRecord = {
      id: crypto.randomUUID(),
      name: body.name,
      status: 'draft',
      allocation: body.allocation ?? {},
      guardrails: body.guardrails ?? {},
      result: {},
      createdAt: now,
      updatedAt: now,
    };
    const nextConfig = { ...config, experimentsV1: [created, ...experiments] };
    await db.update(designs).set({ config: nextConfig, updatedAt: new Date() }).where(eq(designs.id, design.id));
    return reply.code(201).send({ data: created });
  });

  fastify.patch<{ Params: { id: string; expId: string } }>('/campaigns/:id/experiments/:expId', async (request, reply) => {
    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, request.params.id), eq(campaigns.tenantId, request.tenantId), isNull(campaigns.deletedAt)),
    });
    if (!campaign) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });

    const body = UpdateExperimentBody.parse(request.body);
    const design = await db.query.designs.findFirst({
      where: and(eq(designs.campaignId, request.params.id), eq(designs.tenantId, request.tenantId)),
    });
    if (!design) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Design not found' } });

    const config = ((design.config ?? {}) as Record<string, any>);
    const experiments = (Array.isArray(config.experimentsV1) ? config.experimentsV1 : []) as ExperimentRecord[];
    let found = false;
    const updatedExperiments = experiments.map((exp) => {
      if (exp.id !== request.params.expId) return exp;
      found = true;
      return {
        ...exp,
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.allocation !== undefined ? { allocation: body.allocation } : {}),
        ...(body.guardrails !== undefined ? { guardrails: body.guardrails } : {}),
        ...(body.result !== undefined ? { result: body.result } : {}),
        updatedAt: new Date().toISOString(),
      };
    });

    if (!found) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Experiment not found' } });
    const nextConfig = { ...config, experimentsV1: updatedExperiments };
    await db.update(designs).set({ config: nextConfig, updatedAt: new Date() }).where(eq(designs.id, design.id));
    const updated = updatedExperiments.find((x) => x.id === request.params.expId);
    return reply.send({ data: updated });
  });
};
