import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, eq, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { leads, campaigns } from '../db/schema.js';

/**
 * Lead capture API (CTO-AUDIT P0-3). Leads are populated server-side from the /e ingest path
 * when a conversion event carries an email. All routes are tenant-scoped via request.tenantId.
 */

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  campaignId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
});

const FilterQuery = z.object({
  campaignId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
});

export const leadRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/leads — list captured leads (tenant-scoped, filterable, paginated, newest first)
  fastify.get('/leads', async (request, reply) => {
    const q = ListQuery.parse(request.query);
    const where = and(
      eq(leads.tenantId, request.tenantId),
      q.campaignId ? eq(leads.campaignId, q.campaignId) : undefined,
      q.siteId ? eq(leads.siteId, q.siteId) : undefined,
    );

    const [rows, totals] = await Promise.all([
      db
        .select({
          id: leads.id, email: leads.email, name: leads.name,
          campaignId: leads.campaignId, siteId: leads.siteId,
          source: leads.source, pageUrl: leads.pageUrl, createdAt: leads.createdAt,
        })
        .from(leads)
        .where(where)
        .orderBy(desc(leads.createdAt))
        .limit(q.limit)
        .offset(q.offset),
      db.select({ total: sql<number>`count(*)::int` }).from(leads).where(where),
    ]);

    // Attach campaign names for display (batched, tenant-scoped).
    const campaignIds = [...new Set(rows.map((r) => r.campaignId).filter((x): x is string => !!x))];
    const nameById = campaignIds.length
      ? new Map(
          (await db
            .select({ id: campaigns.id, name: campaigns.name })
            .from(campaigns)
            .where(and(eq(campaigns.tenantId, request.tenantId), inArray(campaigns.id, campaignIds))))
            .map((c) => [c.id, c.name]),
        )
      : new Map<string, string>();

    const data = rows.map((r) => ({
      ...r,
      campaignName: r.campaignId ? nameById.get(r.campaignId) ?? null : null,
    }));

    return reply.send({ data, meta: { total: totals[0]?.total ?? 0, limit: q.limit, offset: q.offset } });
  });

  // GET /api/v1/leads/export — CSV download of leads (filterable, tenant-scoped)
  fastify.get('/leads/export', async (request, reply) => {
    const q = FilterQuery.parse(request.query);
    const where = and(
      eq(leads.tenantId, request.tenantId),
      q.campaignId ? eq(leads.campaignId, q.campaignId) : undefined,
      q.siteId ? eq(leads.siteId, q.siteId) : undefined,
    );

    const rows = await db
      .select({
        email: leads.email, name: leads.name, campaignId: leads.campaignId,
        source: leads.source, pageUrl: leads.pageUrl, createdAt: leads.createdAt,
      })
      .from(leads)
      .where(where)
      .orderBy(desc(leads.createdAt))
      .limit(100000);

    const header = ['email', 'name', 'campaign_id', 'source', 'page_url', 'created_at'];
    const esc = (v: unknown) => {
      const s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [header.join(',')]
      .concat(rows.map((r) => [r.email, r.name, r.campaignId, r.source, r.pageUrl, r.createdAt].map(esc).join(',')))
      .join('\n');

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="scrollpop-leads-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  });

  // DELETE /api/v1/leads/:id — remove a captured lead (GDPR / cleanup). Hard delete: a lead is
  // PII the operator may be legally required to erase on request.
  fastify.delete<{ Params: { id: string } }>('/leads/:id', async (request, reply) => {
    const [deleted] = await db
      .delete(leads)
      .where(and(eq(leads.id, request.params.id), eq(leads.tenantId, request.tenantId)))
      .returning({ id: leads.id });
    if (!deleted) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });
    }
    return reply.code(204).send();
  });
};
