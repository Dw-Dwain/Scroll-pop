import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client.js';
import { sites, campaigns, designs, triggers, targetingRules, frequencyRules, events } from '../db/schema.js';
import { eq, and, isNull, sql } from 'drizzle-orm';
import type { SiteConfigPayload } from '@scrollpop/shared';
import crypto from 'node:crypto';

/**
 * Internal routes — called by the Cloudflare Worker, NOT authenticated via Clerk.
 * Auth: X-Internal-Secret header must match API_SECRET env var.
 */

function assertInternalSecret(request: FastifyRequest, reply: FastifyReply): boolean {
  const secret = process.env['API_SECRET'] || 'change_me_in_production_32_chars_min';
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

      // Get all active campaigns for this site
      const activeCampaigns = await db.query.campaigns.findMany({
        where: and(
          eq(campaigns.siteId, site.id),
          eq(campaigns.status, 'active'),
          isNull(campaigns.deletedAt)
        ),
      });

      // For each campaign, fetch design + triggers + targeting + frequency
      const campaignConfigs = await Promise.all(
        activeCampaigns.map(async (campaign) => {
          const [design, campaignTriggers, targeting, freq] = await Promise.all([
            db.query.designs.findFirst({
              where: and(
                eq(designs.campaignId, campaign.id),
                eq(designs.tenantId, campaign.tenantId)
              ),
            }),
            db.query.triggers.findMany({
              where: and(
                eq(triggers.campaignId, campaign.id),
                eq(triggers.tenantId, campaign.tenantId)
              ),
            }),
            db.query.targetingRules.findMany({
              where: and(
                eq(targetingRules.campaignId, campaign.id),
                eq(targetingRules.tenantId, campaign.tenantId)
              ),
            }),
            db.query.frequencyRules.findFirst({
              where: and(
                eq(frequencyRules.campaignId, campaign.id),
                eq(frequencyRules.tenantId, campaign.tenantId)
              ),
            }),
          ]);

          if (!design) return null;

          return {
            id: campaign.id,
            design: design.config,
            triggers: campaignTriggers.map((t) => ({
              id: t.id,
              type: t.type,
              params: t.params,
            })),
            targeting: targeting.map((r) => ({
              id: r.id,
              kind: r.kind,
              operator: r.operator,
              value: r.value,
            })),
            frequency: { frequency: freq?.frequency ?? 'once_per_session' },
            affiliateSlots: design.affiliateSlots,
          };
        })
      );

      const validCampaigns = campaignConfigs.filter(Boolean);

      // Generate a version hash for cache-busting
      const version = crypto
        .createHash('sha256')
        .update(JSON.stringify(validCampaigns))
        .digest('hex')
        .slice(0, 8);

      const payload: SiteConfigPayload = {
        siteId: site.id,
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

      const kvKey = `config:${request.params.publicKey}`;
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

  // GET /api/v1/internal/test-db — Diagnostic route for DB debugging in production
  fastify.get('/test-db', async (request, reply) => {
    if (!assertInternalSecret(request, reply)) return;
    try {
      const c = await db.query.campaigns.findFirst();
      const countEvents = await db.select({ count: sql<number>`count(*)::int` }).from(events);
      return reply.send({ ok: true, firstCampaign: c, countEvents });
    } catch (err: any) {
      return reply.send({ ok: false, error: err.message, stack: err.stack });
    }
  });

  // GET /api/v1/internal/debug-campaign/:id — Diagnostic route to debug campaign query in production
  fastify.get<{ Params: { id: string } }>('/debug-campaign/:id', async (request, reply) => {
    if (!assertInternalSecret(request, reply)) return;
    try {
      const { id } = request.params;
      const campaign = await db.query.campaigns.findFirst({
        where: eq(campaigns.id, id),
      });
      const allCampaignsCount = await db.select({ count: sql<number>`count(*)::int` }).from(campaigns);
      return reply.send({ ok: true, campaignId: id, campaignFound: campaign, allCampaignsCount });
    } catch (err: any) {
      return reply.send({ ok: false, error: err.message, stack: err.stack });
    }
  });

  // POST /api/v1/internal/debug-insert/:id — Try direct insert test for campaign ID
  fastify.post<{ Params: { id: string } }>('/debug-insert/:id', async (request, reply) => {
    if (!assertInternalSecret(request, reply)) return;
    try {
      const { id } = request.params;
      const campaign = await db.query.campaigns.findFirst({
        where: eq(campaigns.id, id),
      });
      if (!campaign) {
        return reply.send({ ok: false, error: 'Campaign not found for insert test' });
      }
      const res = await db.insert(events).values({
        tenantId: campaign.tenantId,
        siteId: campaign.siteId,
        campaignId: id,
        eventType: 'impression',
        visitorId: 'debug-visitor',
        sessionId: 'debug-session',
        device: 'desktop',
        pageUrl: 'http://debug-url',
        referrer: '',
        ts: new Date(),
        country: 'US',
      }).returning();
      return reply.send({ ok: true, result: res });
    } catch (err: any) {
      return reply.send({ ok: false, error: err.message, stack: err.stack });
    }
  });
};

