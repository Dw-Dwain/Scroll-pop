import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Readable } from 'node:stream';
import { db, systemDb } from '../db/client.js';
import { campaigns, sites, designs, events, triggers, targetingRules, frequencyRules } from '../db/schema.js';
import { eq, and, isNull, desc, lt, sql } from 'drizzle-orm';
import { AffiliateSlotSchema, TriggerParamsSchema } from '@scrollpop/shared';
import { emitNotification } from './notifications.js';
import { purgeSiteConfigCache } from '../lib/cache-purge.js';
import { coerceKind } from './designs.js';

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

// ─── Transactional canvas save (campaign-save reliability) ──────────────────────
// One atomic write for everything the visual designer edits: design + triggers +
// frequency + targeting. Previously the dashboard fired four independent HTTP PUTs
// and reported success even if the trailing three failed, so an edit could persist
// partially while the UI claimed "published". This endpoint folds all four into a
// single db.transaction — all-or-nothing — and returns the freshly persisted rows so
// the client can reconcile its state without a manual refresh.

const CanvasDesignSchema = z.object({
  kind: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  affiliateSlots: z.array(AffiliateSlotSchema).max(3).optional(),
});

const CanvasTriggerSchema = z.object({
  // back_button_capture is NOT a valid type — CLAUDE.md rule #1.
  type: z.enum(['scroll_pct', 'dwell_time', 'inactivity', 'exit_intent_mouse', 'click']),
  params: z.record(z.unknown()).default({}),
});

const CanvasTargetingSchema = z.object({
  kind: z.enum(['url_exact', 'url_contains', 'url_regex', 'device', 'returning_visitor', 'geo', 'session_page_views', 'utm', 'ab_test']),
  operator: z.enum(['include', 'exclude']).default('include'),
  value: z.record(z.unknown()),
});

const CanvasFrequencySchema = z.object({
  frequency: z.enum(['once_per_session', 'once_per_day', 'once_per_visitor', 'always']),
  intervalDays: z.number().int().min(1).optional(),
  maxDisplayCount: z.number().int().min(0).max(1000).nullable().optional(),
  cooldownSeconds: z.number().int().min(0).max(31536000).nullable().optional(),
  showAgainIfConverts: z.boolean().optional(),
});

const CanvasBody = z.object({
  design: CanvasDesignSchema.optional(),
  triggers: z.array(CanvasTriggerSchema).optional(),
  targeting: z.array(CanvasTargetingSchema).optional(),
  frequency: CanvasFrequencySchema.optional(),
});

// Mirrors the ReDoS guard in routes/targeting.ts so the bundle endpoint can't be
// used to smuggle a catastrophic-backtracking pattern past the per-route validation.
function validateCanvasRegex(pattern: unknown): string | null {
  if (typeof pattern !== 'string') return 'Pattern must be a string';
  if (pattern.length === 0 || pattern.length > 100) return 'Pattern must be 1–100 characters';
  try {
    new RegExp(pattern);
  } catch {
    return 'Invalid regular expression';
  }
  if (/\([^()]*[+*][^()]*\)[+*{]/.test(pattern)) {
    return 'Pattern contains nested quantifiers that may cause ReDoS';
  }
  return null;
}

export const campaignRoutes: FastifyPluginAsync = async (fastify) => {
  // Invalidate a campaign's site edge-config cache so status changes propagate immediately
  // instead of lingering for the 60s cache TTL (CTO-AUDIT Phase 4, Finding 2 / P0-5).
  async function purgeCampaignSiteCache(siteId: string): Promise<void> {
    try {
      const site = await db.query.sites.findFirst({
        where: eq(sites.id, siteId),
        columns: { publicKey: true },
      });
      if (site?.publicKey) await purgeSiteConfigCache(site.publicKey);
    } catch {
      /* best-effort — the 60s TTL is the fallback */
    }
  }

  // GET /api/v1/campaigns
  fastify.get<{ Querystring: { siteId?: string; status?: string; clientId?: string } }>(
    '/campaigns',
    async (request, reply) => {
      const { siteId, status, clientId } = request.query;

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
            // Agency client scoping: restrict to campaigns whose site belongs to the client.
            clientId
              ? sql`${campaigns.siteId} IN (SELECT id FROM sites WHERE client_id = ${clientId}::uuid AND tenant_id = ${request.tenantId}::uuid)`
              : undefined,
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
    // Bust the edge config cache so a deleted active campaign stops serving immediately.
    void purgeCampaignSiteCache(deleted.siteId);
    return reply.code(200).send({ data: deleted });
  });

  // POST /api/v1/campaigns/:id/duplicate — clone a campaign (+ its design, triggers,
  // targeting, frequency) as a new DRAFT. Analytics/events are NOT copied. Tenant-scoped.
  fastify.post<{ Params: { id: string } }>('/campaigns/:id/duplicate', async (request, reply) => {
    const source = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, request.params.id),
        eq(campaigns.tenantId, request.tenantId),
        isNull(campaigns.deletedAt)
      ),
    });
    if (!source) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    // Create the new campaign as a draft. Name suffixed "(Copy)", capped to the 200-char column.
    const copyName = `${source.name} (Copy)`.slice(0, 200);
    const [clone] = await db
      .insert(campaigns)
      .values({
        tenantId: request.tenantId,
        siteId: source.siteId,
        name: copyName,
        status: 'draft',
        startsAt: source.startsAt,
        endsAt: source.endsAt,
      })
      .returning();
    if (!clone) {
      return reply.code(500).send({ error: { code: 'CLONE_FAILED', message: 'Could not duplicate campaign' } });
    }

    // Clone child rows. Sequential (not Promise.all): under RLS the per-request tenant connection
    // is a single reserved connection that can't run concurrent queries → 500.
    const srcDesign = await db.query.designs.findFirst({ where: and(eq(designs.campaignId, source.id), eq(designs.tenantId, request.tenantId)) });
    const srcTriggers = await db.query.triggers.findMany({ where: and(eq(triggers.campaignId, source.id), eq(triggers.tenantId, request.tenantId)) });
    const srcTargeting = await db.query.targetingRules.findMany({ where: and(eq(targetingRules.campaignId, source.id), eq(targetingRules.tenantId, request.tenantId)) });
    const srcFreq = await db.query.frequencyRules.findFirst({ where: and(eq(frequencyRules.campaignId, source.id), eq(frequencyRules.tenantId, request.tenantId)) });

    if (srcDesign) {
      await db.insert(designs).values({
        campaignId: clone.id,
        tenantId: request.tenantId,
        kind: srcDesign.kind,
        config: srcDesign.config,
        affiliateSlots: srcDesign.affiliateSlots,
      });
    }
    if (srcTriggers.length > 0) {
      await db.insert(triggers).values(
        srcTriggers.map((t) => ({ campaignId: clone.id, tenantId: request.tenantId, type: t.type, params: t.params }))
      );
    }
    if (srcTargeting.length > 0) {
      await db.insert(targetingRules).values(
        srcTargeting.map((r) => ({ campaignId: clone.id, tenantId: request.tenantId, kind: r.kind, operator: r.operator, value: r.value }))
      );
    }
    if (srcFreq) {
      await db.insert(frequencyRules).values({
        campaignId: clone.id,
        tenantId: request.tenantId,
        frequency: srcFreq.frequency,
        intervalDays: srcFreq.intervalDays,
      });
    }

    return reply.code(201).send({ data: clone });
  });

  // GET /api/v1/campaigns/:id/export — CSV of this campaign's raw event data.
  // Streams via cursor-paginated batches so large exports never hold a full result-set in
  // memory (P2-10). Works for soft-deleted campaigns within the 24h download grace window.
  fastify.get<{ Params: { id: string } }>('/campaigns/:id/export', async (request, reply) => {
    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, request.params.id), eq(campaigns.tenantId, request.tenantId)),
      columns: { id: true, name: true },
    });
    if (!campaign) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const BATCH = 500;
    const header = ['timestamp', 'event_type', 'device', 'country', 'page_url', 'referrer', 'visitor_id', 'session_id', 'revenue_cents'];
    const esc = (v: unknown) => {
      const s = v == null ? '' : (v instanceof Date ? v.toISOString() : String(v));
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csvStream = new Readable({ read() {} });
    csvStream.push(header.join(',') + '\n');

    (async () => {
      let cursor: Date | null = null;
      try {
        while (true) {
          const batch = await db
            .select({
              ts: events.ts, eventType: events.eventType, device: events.device,
              country: events.country, pageUrl: events.pageUrl, referrer: events.referrer,
              visitorId: events.visitorId, sessionId: events.sessionId, revenueCents: events.revenueCents,
            })
            .from(events)
            .where(and(
              eq(events.tenantId, request.tenantId),
              eq(events.campaignId, request.params.id),
              cursor ? lt(events.ts, cursor) : undefined,
            ))
            .orderBy(desc(events.ts))
            .limit(BATCH);

          for (const r of batch) {
            csvStream.push(
              [r.ts, r.eventType, r.device, r.country, r.pageUrl, r.referrer, r.visitorId, r.sessionId, r.revenueCents]
                .map(esc).join(',') + '\n',
            );
          }
          if (batch.length < BATCH) break;
          cursor = batch[batch.length - 1]!.ts;
        }
      } catch (err) {
        csvStream.destroy(err instanceof Error ? err : new Error(String(err)));
      } finally {
        csvStream.push(null);
      }
    })();

    const safeName = (campaign.name || 'campaign').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40);
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="scrollpop-${safeName}-${request.params.id.slice(0, 8)}.csv"`)
      .send(csvStream);
  });

  // POST & PATCH /api/v1/campaigns/:id/activate
  const handleActivate = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
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

    void emitNotification(request.tenantId, {
      type: 'notif_campaign_status',
      title: `Campaign "${updated.name}" is live`,
      body: 'Your popup is now active and serving on its site.',
      href: `/campaigns/detail/${updated.id}`,
    });

    // Bust the edge config cache so the newly-active campaign serves immediately.
    void purgeCampaignSiteCache(updated.siteId);
    return reply.send({ data: updated });
  };

  fastify.post<{ Params: { id: string } }>('/campaigns/:id/activate', handleActivate);
  fastify.patch<{ Params: { id: string } }>('/campaigns/:id/activate', handleActivate);

  // POST & PATCH /api/v1/campaigns/:id/pause
  const handlePause = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
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

    void emitNotification(request.tenantId, {
      type: 'notif_campaign_status',
      title: `Campaign "${updated.name}" paused`,
      body: 'Popups for this campaign have stopped serving.',
      href: `/campaigns/detail/${updated.id}`,
    });

    // Bust the edge config cache so the popup stops serving immediately, not after the TTL.
    void purgeCampaignSiteCache(updated.siteId);
    return reply.send({ data: updated });
  };

  fastify.post<{ Params: { id: string } }>('/campaigns/:id/pause', handlePause);
  fastify.patch<{ Params: { id: string } }>('/campaigns/:id/pause', handlePause);

  // PUT /api/v1/campaigns/:id/canvas — atomic design+triggers+frequency+targeting save.
  fastify.put<{ Params: { id: string } }>('/campaigns/:id/canvas', async (request, reply) => {
    const body = CanvasBody.parse(request.body);

    // Validate everything BEFORE opening the transaction so a bad field can't leave a
    // half-applied write (and so the client gets a clean 400, not a partial 200).
    if (body.triggers) {
      for (const t of body.triggers) TriggerParamsSchema.parse({ type: t.type, ...t.params });
    }
    if (body.targeting) {
      for (const rule of body.targeting) {
        if (rule.kind === 'url_regex') {
          const err = validateCanvasRegex((rule.value as Record<string, unknown>)['pattern']);
          if (err) return reply.code(400).send({ error: { code: 'INVALID_REGEX', message: err } });
        }
      }
    }

    const tenantId = request.tenantId;
    const campaignId = request.params.id;

    // Run the bundle on the SYSTEM pool: when RLS is active, `db` is a reserved single tenant
    // connection and drizzle's .transaction() on it throws (begin can't re-reserve) → 500 on every
    // save. systemDb is a normal pool that transacts cleanly. Safe here because ownership is verified
    // above and every write below is hard-scoped to request.tenantId (same pattern as admin/team).
    const result = await systemDb.transaction(async (tx) => {
      // Ownership check inside the tx — if the campaign isn't this tenant's (or is
      // soft-deleted) nothing is written.
      const campaign = await tx.query.campaigns.findFirst({
        where: and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId), isNull(campaigns.deletedAt)),
      });
      if (!campaign) return { notFound: true as const };

      // ── Design (upsert, shallow-merge config like routes/designs.ts) ──
      let savedDesign: typeof designs.$inferSelect | undefined;
      if (body.design) {
        const coercedKind = coerceKind(body.design.kind);
        const existing = await tx.query.designs.findFirst({
          where: and(eq(designs.campaignId, campaignId), eq(designs.tenantId, tenantId)),
        });
        if (existing) {
          [savedDesign] = await tx
            .update(designs)
            .set({
              kind: coercedKind ?? existing.kind,
              config: body.design.config ? { ...(existing.config as object), ...body.design.config } : existing.config,
              affiliateSlots: body.design.affiliateSlots ?? existing.affiliateSlots,
              updatedAt: new Date(),
            })
            .where(eq(designs.id, existing.id))
            .returning();
        } else {
          [savedDesign] = await tx
            .insert(designs)
            .values({
              campaignId,
              tenantId,
              kind: coercedKind ?? 'modal',
              config: body.design.config ?? {},
              affiliateSlots: body.design.affiliateSlots ?? [],
            })
            .returning();
        }
      }

      // ── Triggers (full replace) ──
      let savedTriggers: (typeof triggers.$inferSelect)[] | undefined;
      if (body.triggers) {
        await tx.delete(triggers).where(and(eq(triggers.campaignId, campaignId), eq(triggers.tenantId, tenantId)));
        savedTriggers = body.triggers.length
          ? await tx.insert(triggers).values(body.triggers.map((t) => ({
              campaignId, tenantId, type: t.type, params: t.params,
            }))).returning()
          : [];
      }

      // ── Frequency (upsert) ──
      let savedFrequency: typeof frequencyRules.$inferSelect | undefined;
      if (body.frequency) {
        const f = body.frequency;
        const existing = await tx.query.frequencyRules.findFirst({
          where: and(eq(frequencyRules.campaignId, campaignId), eq(frequencyRules.tenantId, tenantId)),
        });
        const values = {
          frequency: f.frequency,
          intervalDays: f.intervalDays ?? null,
          maxDisplayCount: f.maxDisplayCount ?? null,
          cooldownSeconds: f.cooldownSeconds ?? null,
          showAgainIfConverts: f.showAgainIfConverts ?? false,
        };
        if (existing) {
          [savedFrequency] = await tx.update(frequencyRules).set(values)
            .where(and(eq(frequencyRules.id, existing.id), eq(frequencyRules.tenantId, tenantId))).returning();
        } else {
          [savedFrequency] = await tx.insert(frequencyRules).values({ campaignId, tenantId, ...values }).returning();
        }
      }

      // ── Targeting (full replace) ──
      let savedTargeting: (typeof targetingRules.$inferSelect)[] | undefined;
      if (body.targeting) {
        await tx.delete(targetingRules).where(and(eq(targetingRules.campaignId, campaignId), eq(targetingRules.tenantId, tenantId)));
        savedTargeting = body.targeting.length
          ? await tx.insert(targetingRules).values(body.targeting.map((r) => ({
              campaignId, tenantId, kind: r.kind, operator: r.operator, value: r.value,
            }))).returning()
          : [];
      }

      return { notFound: false as const, campaign, savedDesign, savedTriggers, savedFrequency, savedTargeting };
    });

    if (result.notFound) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    // Bust the edge config cache so the saved state serves immediately (best-effort,
    // post-commit so a cache hiccup can't roll back a committed save).
    void purgeCampaignSiteCache(result.campaign.siteId);

    return reply.send({
      data: {
        design: result.savedDesign ?? null,
        triggers: result.savedTriggers ?? null,
        frequency: result.savedFrequency ?? null,
        targeting: result.savedTargeting ?? null,
      },
    });
  });
};

