import Fastify from 'fastify';
import { clerkPlugin } from '@clerk/fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Redis } from '@upstash/redis';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { db } from './db/client.js';
import { sites, campaigns, designs, triggers, targetingRules, frequencyRules, events } from './db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';

// Routes
import { siteRoutes } from './routes/sites.js';
import { campaignRoutes } from './routes/campaigns.js';
import { designRoutes } from './routes/designs.js';
import { triggerRoutes } from './routes/triggers.js';
import { targetingRoutes } from './routes/targeting.js';
import { analyticsRoutes } from './routes/analytics.js';
import { billingRoutes } from './routes/billing.js';
import { webhookRoutes } from './routes/webhooks.js';
import { internalRoutes } from './routes/internal.js';
import { meRoutes } from './routes/me.js';
import { tenantRoutes } from './routes/tenants.js';

// Plugins
import { tenantContextPlugin } from './plugins/tenant-context.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';

const isDev = process.env['NODE_ENV'] !== 'production';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({
  logger: isDev
    ? { level: 'info', transport: { target: 'pino-pretty' } }
    : { level: 'warn' },
  ignoreTrailingSlash: true,
});

// Redis client (shared)
export const redis = process.env['REDIS_URL']?.startsWith('redis://')
  ? null // local Redis — use ioredis in dev if needed
  : new Redis({
      url: process.env['REDIS_URL'] ?? '',
      token: process.env['REDIS_TOKEN'] ?? '',
    });

async function bootstrap() {
  // CORS
  await app.register(cors, {
    origin: process.env['NODE_ENV'] === 'production'
      ? ['https://app.scrollpop.io', 'https://scrollpop.io']
      : true,
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.headers['x-tenant-id'] as string ?? req.ip,
  });

  // Clerk auth
  await app.register(clerkPlugin);

  // Error handler
  await app.register(errorHandlerPlugin);

  // Tenant context (decodes Clerk JWT → req.tenantId, req.userId)
  await app.register(tenantContextPlugin);

  // Webhooks (no auth — use signature verification)
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });

  // Internal (called by Cloudflare Worker, auth via API_SECRET header)
  await app.register(internalRoutes, { prefix: '/api/v1/internal' });

  // Authenticated routes
  await app.register(meRoutes, { prefix: '/api/v1' });
  await app.register(siteRoutes, { prefix: '/api/v1' });
  await app.register(campaignRoutes, { prefix: '/api/v1' });
  await app.register(designRoutes, { prefix: '/api/v1' });
  await app.register(triggerRoutes, { prefix: '/api/v1' });
  await app.register(targetingRoutes, { prefix: '/api/v1' });
  await app.register(analyticsRoutes, { prefix: '/api/v1' });
  await app.register(billingRoutes, { prefix: '/api/v1' });
  await app.register(tenantRoutes, { prefix: '/api/v1' });

  // ─── Local Development Snippet & Edge Routes ────────────────────────────────
  // Enables instant local theme/HTML testing without Cloudflare dependencies

  // 1. Local Snippet Serving Route
  app.get<{ Params: { publicKey: string } }>(
    '/v1/:publicKey/p.js',
    async (request, reply) => {
      const filePath = path.resolve(__dirname, '../../../packages/snippet/dist/p.js');
      try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        void reply
          .type('application/javascript')
          .headers({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          })
          .send(content);
      } catch (err) {
        request.log.error(err, 'Local snippet file not found. Ensure pnpm build has run.');
        void reply
          .code(404)
          .headers({
            'Access-Control-Allow-Origin': '*',
          })
          .send('Snippet bundle not built yet. Run: pnpm build');
      }
    }
  );

  // 2. Local Config Route (Simulates Edge KV cache-miss directly against local DB)
  app.get<{ Params: { publicKey: string } }>(
    '/c/:publicKey',
    async (request, reply) => {
      const { publicKey } = request.params;

      // Look up site by public key
      const site = await db.query.sites.findFirst({
        where: and(eq(sites.publicKey, publicKey), isNull(sites.deletedAt)),
      });

      if (!site) {
        return reply
          .code(404)
          .headers({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          })
          .send({ error: 'Site not found' });
      }

      // Get all active campaigns for this site
      const activeCampaigns = await db.query.campaigns.findMany({
        where: and(
          eq(campaigns.siteId, site.id),
          eq(campaigns.status, 'active'),
          isNull(campaigns.deletedAt)
        ),
      });

      // Fetch configurations matching Cloudflare Worker schema
      const campaignConfigs = await Promise.all(
        activeCampaigns.map(async (campaign) => {
          const [design, campaignTriggers, targeting, freq] = await Promise.all([
            db.query.designs.findFirst({
              where: eq(designs.campaignId, campaign.id),
            }),
            db.query.triggers.findMany({
              where: eq(triggers.campaignId, campaign.id),
            }),
            db.query.targetingRules.findMany({
              where: eq(targetingRules.campaignId, campaign.id),
            }),
            db.query.frequencyRules.findFirst({
              where: eq(frequencyRules.campaignId, campaign.id),
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

      const version = crypto
        .createHash('sha256')
        .update(JSON.stringify(validCampaigns))
        .digest('hex')
        .slice(0, 8);

      const payload = {
        siteId: site.id,
        campaigns: validCampaigns,
        version,
      };

      void reply
        .type('application/json')
        .headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        })
        .send(payload);
    }
  );

  // 3. Local Ingest Route (Prevents fetch errors when snippet beacons analytics)
  app.post<{ Body: { events?: any[] } }>('/e', async (request, reply) => {
    const payload = request.body;
    if (payload && Array.isArray(payload.events)) {
      for (const rawEvt of payload.events) {
        const { campaignId, eventType, affiliateSlotId, visitorId, sessionId, device, pageUrl, referrer, ts, country } = rawEvt;
        if (!campaignId || !eventType) continue;

        try {
          const campaign = await db.query.campaigns.findFirst({
            where: eq(campaigns.id, campaignId),
          });

          if (campaign) {
            await db.insert(events).values({
              tenantId: campaign.tenantId,
              siteId: campaign.siteId,
              campaignId,
              eventType,
              affiliateSlotId: affiliateSlotId || null,
              visitorId: visitorId || null,
              sessionId: sessionId || null,
              device: device || null,
              pageUrl: pageUrl || null,
              referrer: referrer || null,
              ts: ts ? new Date(ts) : new Date(),
              country: country || null,
            });
          }
        } catch (err) {
          request.log.error(err, 'Failed to insert analytic event');
        }
      }
    }

    void reply
      .type('application/json')
      .headers({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
      })
      .send({ received: true });
  });

  // Health check
  app.get('/health', async () => ({ ok: true, ts: Date.now() }));

  const port = parseInt(process.env['PORT'] ?? '3001', 10);
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`API running on port ${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
