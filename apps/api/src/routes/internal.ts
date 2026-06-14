import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client.js';
import { sites, campaigns, designs, triggers, targetingRules, frequencyRules, events, tenants, variants, journeys } from '../db/schema.js';
import { eq, and, isNull, sql, gte, inArray } from 'drizzle-orm';
import type { SiteConfigPayload } from '@scrollpop/shared';
import crypto from 'node:crypto';
import { redis } from '../index.js';
import { stripJourneyStepTriggers } from '../lib/journey-config.js';

/** Group rows by their campaignId into a Map for O(1) per-campaign assembly. */
function groupByCampaignId<T extends { campaignId: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const arr = m.get(r.campaignId);
    if (arr) arr.push(r);
    else m.set(r.campaignId, [r]);
  }
  return m;
}

/**
 * Internal routes — called by the Cloudflare Worker, NOT authenticated via Clerk.
 * Auth: the X-Internal-Secret header must match the INTERNAL_SECRET env var
 * (API_SECRET kept as a legacy fallback). This is the SAME value the Worker
 * sends as its INTERNAL_SECRET secret.
 */

function assertInternalSecret(request: FastifyRequest, reply: FastifyReply): boolean {
  const secret = process.env['INTERNAL_SECRET'];
  const provided = request.headers['x-internal-secret'] as string | undefined;

  if (!secret || provided !== secret) {
    void reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid internal secret' } });
    return false;
  }
  return true;
}

export const internalRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/internal/config/:publicKey
   * Called by the Cloudflare Worker on KV cache miss.
   * Returns the full site config payload for the snippet.
   */
  fastify.get<{ Params: { publicKey: string } }>(
    '/config/:publicKey',
    async (request, reply) => {
      if (!assertInternalSecret(request, reply)) return;

      const { publicKey } = request.params;

      // Look up site by public key
      const site = await db.query.sites.findFirst({
        where: and(eq(sites.publicKey, publicKey), isNull(sites.deletedAt)),
      });

      if (!site) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Site not found' } });
      }

      // ── Monthly view-limit enforcement ────────────────────────────────────────
      // Check how many impressions this tenant has had this calendar month.
      // Redis counter is the fast path; DB query is the fallback.
      // Fail OPEN: if both checks fail, serve the config rather than block users.
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, site.tenantId),
        columns: { monthlyViewLimit: true, plan: true, notificationPrefs: true },
      });
      // Strict per-tenant opt-in consent: when on, the snippet records no analytics
      // until the host grants consent. Stored in the tenant prefs JSONB (no migration).
      const requireConsent = !!((tenant?.notificationPrefs as Record<string, unknown> | undefined)?.['require_consent']);
      // Optional GDPR/CCPA consent bar — stored alongside require_consent in the tenant prefs
      // JSONB (no migration). Only forwarded to the snippet when the operator has enabled it.
      const consentBanner = (tenant?.notificationPrefs as Record<string, unknown> | undefined)?.['consentBanner'] as
        SiteConfigPayload['consentBanner'] | undefined;

      if (tenant && tenant.monthlyViewLimit > 0) {
        let monthlyViews = 0;
        const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"
        const redisKey = `sp_views:${site.tenantId}:${month}`;

        if (redis) {
          try {
            const cached = await redis.get<number>(redisKey);
            monthlyViews = cached ?? 0;
          } catch { /* fall through to DB */ }
        }

        // DB fallback: count impressions this calendar month
        if (monthlyViews === 0) {
          try {
            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            const [row] = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(events)
              .where(
                and(
                  eq(events.tenantId, site.tenantId),
                  eq(events.eventType, 'impression'),
                  gte(events.ts, monthStart)
                )
              );
            monthlyViews = row?.count ?? 0;
          } catch { /* fail open */ }
        }

        if (monthlyViews >= tenant.monthlyViewLimit) {
          // Over limit — return empty campaigns so no popup renders.
          // Short TTL so upgrades take effect quickly.
          return reply.send({
            siteId: site.id,
            campaigns: [],
            version: 'limited',
            limitExceeded: true,
          });
        }
      }
      // ── End view-limit enforcement ────────────────────────────────────────────

      // Get all active campaigns for this site
      const activeCampaigns = await db.query.campaigns.findMany({
        where: and(
          eq(campaigns.siteId, site.id),
          eq(campaigns.status, 'active'),
          isNull(campaigns.deletedAt)
        ),
      });

      // Batch-fetch design + triggers + targeting + frequency for ALL active campaigns in 4
      // queries total. This was previously 4 queries PER campaign (an N+1 that scaled with
      // campaign count on every KV cache miss). All campaigns belong to this site's tenant.
      // CTO-AUDIT Phase 3 / P1-4.
      const campaignIds = activeCampaigns.map((c) => c.id);
      let validCampaigns: SiteConfigPayload['campaigns'] = [];

      if (campaignIds.length > 0) {
        const tid = site.tenantId;
        const [allDesigns, allTriggers, allTargeting, allFreq, allVariants] = await Promise.all([
          db.query.designs.findMany({ where: and(inArray(designs.campaignId, campaignIds), eq(designs.tenantId, tid)) }),
          db.query.triggers.findMany({ where: and(inArray(triggers.campaignId, campaignIds), eq(triggers.tenantId, tid)) }),
          db.query.targetingRules.findMany({ where: and(inArray(targetingRules.campaignId, campaignIds), eq(targetingRules.tenantId, tid)) }),
          db.query.frequencyRules.findMany({ where: and(inArray(frequencyRules.campaignId, campaignIds), eq(frequencyRules.tenantId, tid)) }),
          db.query.variants.findMany({ where: and(inArray(variants.campaignId, campaignIds), eq(variants.tenantId, tid)) }),
        ]);

        const designByCampaign = new Map(allDesigns.map((d) => [d.campaignId, d]));
        const freqByCampaign = new Map(allFreq.map((f) => [f.campaignId, f]));
        const triggersByCampaign = groupByCampaignId(allTriggers);
        const targetingByCampaign = groupByCampaignId(allTargeting);
        const variantsByCampaign = groupByCampaignId(allVariants);

        validCampaigns = activeCampaigns
          .map((campaign) => {
            const design = designByCampaign.get(campaign.id);
            if (!design) return null;
            // A/B: when a campaign has variants (with weight > 0), the snippet allocates a
            // visitor to one and renders its design instead of the base design.
            const vs = (variantsByCampaign.get(campaign.id) ?? [])
              .filter((v) => v.weight > 0)
              .map((v) => ({ id: v.id, weight: v.weight, design: v.config, affiliateSlots: v.affiliateSlots }));
            return {
              id: campaign.id,
              // Merge the top-level `kind` column into the served design object (the snippet reads
              // `campaign.design.kind`, e.g. to launch the spin wheel). It lives on the designs row,
              // not inside config JSONB, so without this it was always undefined at the edge.
              design: { ...(design.config as Record<string, unknown>), kind: design.kind } as unknown,
              triggers: (triggersByCampaign.get(campaign.id) ?? []).map((t) => ({ id: t.id, type: t.type, params: t.params })),
              targeting: (targetingByCampaign.get(campaign.id) ?? []).map((r) => ({ id: r.id, kind: r.kind, operator: r.operator, value: r.value })),
              frequency: {
                frequency: freqByCampaign.get(campaign.id)?.frequency ?? 'once_per_session',
                maxDisplayCount: freqByCampaign.get(campaign.id)?.maxDisplayCount ?? null,
                cooldownSeconds: freqByCampaign.get(campaign.id)?.cooldownSeconds ?? null,
                showAgainIfConverts: freqByCampaign.get(campaign.id)?.showAgainIfConverts ?? false,
              },
              affiliateSlots: design.affiliateSlots,
              ...(vs.length > 0 ? { variants: vs } : {}),
            };
          })
          .filter(Boolean) as SiteConfigPayload['campaigns'];
      }

      // Published journeys for this site. Their compiled graph is served verbatim to the snippet's
      // journey engine; popup nodes reference campaigns that publish already guaranteed are active
      // + same-site, so they're present in `validCampaigns` above and core.show(id) resolves.
      const journeyRows = await db.query.journeys.findMany({
        where: and(eq(journeys.siteId, site.id), eq(journeys.status, 'active'), isNull(journeys.deletedAt)),
        columns: { compiled: true, startsAt: true, endsAt: true },
      });
      // Overlay the journey-level schedule LIVE (from the row, not the baked compile) so window
      // edits take effect on the next cache purge without forcing a re-publish.
      const compiledJourneys = journeyRows
        .map((j) => {
          const c = j.compiled as Record<string, unknown>;
          if (!c || typeof c !== 'object' || !Array.isArray((c as { nodes?: unknown }).nodes)) return null;
          return {
            ...c,
            schedule: {
              startsAt: j.startsAt ? j.startsAt.toISOString() : null,
              endsAt: j.endsAt ? j.endsAt.toISOString() : null,
            },
          };
        })
        .filter((c) => c !== null) as Record<string, unknown>[];

      // Harden journey steps: strip independent triggers from any campaign referenced by an active
      // journey, so it can ONLY be shown by its journey (never fire out of sequence). Done before
      // the version hash so the cache key reflects it. See lib/journey-config.ts + snippet/journey.ts.
      validCampaigns = stripJourneyStepTriggers(validCampaigns, compiledJourneys);

      // Generate a version hash for cache-busting (covers campaigns AND journeys).
      const version = crypto
        .createHash('sha256')
        .update(JSON.stringify(validCampaigns) + JSON.stringify(compiledJourneys))
        .digest('hex')
        .slice(0, 8);

      const payload: SiteConfigPayload = {
        siteId: site.id,
        plan: (tenant?.plan ?? 'free') as SiteConfigPayload['plan'],
        requireConsent,
        ...(consentBanner?.enabled ? { consentBanner } : {}),
        ...(compiledJourneys.length ? { journeys: compiledJourneys as NonNullable<SiteConfigPayload['journeys']> } : {}),
        // Internal (edge-only) — the Worker enforces the cap on every request in real time
        // then strips these before responding to the browser. This closes the up-to-60s
        // overage window where a KV-cached config keeps serving after a tenant crosses the
        // limit mid-cache. The API check above remains as defence-in-depth (cache-miss path).
        tenantId: site.tenantId,
        monthlyViewLimit: tenant?.monthlyViewLimit ?? 0,
        campaigns: validCampaigns as SiteConfigPayload['campaigns'],
        version,
      };

      return reply.send(payload);
    }
  );

  /**
   * DELETE /api/v1/internal/cache/:publicKey
   * Invalidates KV cache for a site after campaign changes.
   */
  fastify.delete<{ Params: { publicKey: string } }>(
    '/cache/:publicKey',
    async (request, reply) => {
      if (!assertInternalSecret(request, reply)) return;

      const accountId = process.env['CLOUDFLARE_ACCOUNT_ID'];
      const apiToken = process.env['CLOUDFLARE_API_TOKEN'];
      const kvNamespaceId = process.env['CLOUDFLARE_KV_NAMESPACE_ID'];

      if (!accountId || !apiToken || !kvNamespaceId) {
        fastify.log.warn('Cloudflare KV config missing — cache not invalidated');
        return reply.send({ purged: false, reason: 'CF not configured' });
      }

      // Must match the key the Worker writes/reads in apps/worker/src/index.ts.
      const kvKey = `config:v2:${request.params.publicKey}`;
      const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${kvNamespaceId}/values/${encodeURIComponent(kvKey)}`;

      try {
        await fetch(cfUrl, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${apiToken}` },
        });
        return reply.send({ purged: true, key: kvKey });
      } catch (err) {
        fastify.log.error({ err }, 'KV cache purge failed');
        return reply.code(500).send({ error: { code: 'PURGE_FAILED', message: 'KV cache purge failed' } });
      }
    }
  );
};
