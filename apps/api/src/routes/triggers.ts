import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { TriggerParamsSchema } from '@scrollpop/shared';
import { db } from '../db/client.js';
import { triggers, campaigns, events } from '../db/schema.js';
import { eq, and, isNull, gte, sql } from 'drizzle-orm';

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

  // GET /api/v1/campaigns/:id/diagnose — the "why isn't this campaign firing?" trigger debugger,
  // over the last 30 days. Built from the snippet's trigger telemetry:
  //   • trigger_fired   — the trigger CONDITION was met (beaconed once per page load, before the
  //                       frequency cap / one-popup-at-a-time checks).
  //   • trigger_blocked — the trigger fired but display was then SUPPRESSED, with the reason in
  //                       metadata.reason ('frequency_cap' | 'popup_open').
  // So the funnel is: conditions met (rulesEvaluated) → shown (fired) + blocked. `fired` is derived
  // (rulesEvaluated − blocked, floored at 0) because the snippet doesn't beacon a separate "shown"
  // trigger event — the impression is the display proof.
  fastify.get<{ Params: { id: string } }>('/campaigns/:id/diagnose', async (request, reply) => {
    const ok = await assertCampaignOwnership(request.params.id, request.tenantId, reply);
    if (!ok) return;

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const scope = and(
      eq(events.tenantId, request.tenantId),
      eq(events.campaignId, request.params.id),
      gte(events.ts, since),
    );
    const reasonExpr = sql<string>`coalesce(${events.metadata} ->> 'reason', 'unknown')`;

    const [totalsRows, reasonRows] = await Promise.all([
      db
        .select({
          triggered: sql<number>`count(*) filter (where ${events.eventType} = 'trigger_fired')::int`,
          blocked: sql<number>`count(*) filter (where ${events.eventType} = 'trigger_blocked')::int`,
        })
        .from(events)
        .where(scope),
      db
        .select({ reason: reasonExpr, count: sql<number>`count(*)::int` })
        .from(events)
        .where(and(scope, eq(events.eventType, 'trigger_blocked')))
        .groupBy(reasonExpr)
        .orderBy(sql`count(*) desc`)
        .limit(5),
    ]);

    const triggered = totalsRows[0]?.triggered ?? 0;
    const blocked = totalsRows[0]?.blocked ?? 0;
    return reply.send({
      data: {
        windowDays: 30,
        rulesEvaluated: triggered,
        fired: Math.max(0, triggered - blocked),
        blocked,
        topBlockedReasons: reasonRows.map((r) => ({ reason: r.reason, count: r.count })),
      },
    });
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
