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
import { ensureEventPartitions } from './db/ensure-partitions.js';
import { ensureNotificationsSchema } from './db/ensure-notifications.js';
import { sites, campaigns, designs, triggers, targetingRules, frequencyRules, events, tenants } from './db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';

// Routes
import { siteRoutes } from './routes/sites.js';
import { campaignRoutes } from './routes/campaigns.js';
import { designRoutes } from './routes/designs.js';
import { triggerRoutes } from './routes/triggers.js';
import { targetingRoutes } from './routes/targeting.js';
import { frequencyRoutes } from './routes/frequency.js';
import { analyticsRoutes } from './routes/analytics.js';
import { billingRoutes } from './routes/billing.js';
import { webhookRoutes } from './routes/webhooks.js';
import { internalRoutes } from './routes/internal.js';
import { notificationRoutes, emitNotification } from './routes/notifications.js';
import { meRoutes } from './routes/me.js';
import { tenantRoutes } from './routes/tenants.js';
import { opsRoutes } from './routes/ops.js';
import { adminRoutes } from './routes/admin.js';
import { journeyRoutes } from './routes/journeys.js';
import { experimentRoutes } from './routes/experiments.js';
import { shopifyRoutes, shopifyWebhookRoutes } from './routes/shopify.js';

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
  const allowedOrigins = [
    process.env['DASHBOARD_URL'],
    'https://dashboard.scrollpop.online',
    'https://scrollpop-dashboard.pages.dev',
    ...(isDev ? ['http://localhost:5173', 'http://localhost:3000'] : []),
  ].filter((o): o is string => Boolean(o));
  // Allows Cloudflare Pages preview deployments: <hash>.scrollpop-dashboard.pages.dev
  const pagesPreviewPattern = /^https:\/\/[a-z0-9-]+\.scrollpop-dashboard\.pages\.dev$/;
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin) || pagesPreviewPattern.test(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
    // Explicitly allow the methods/headers the dashboard uses — the design editor
    // saves via PUT, which was missing from the default preflight allow-list.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-Tenant-Override'],
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
  await app.register(shopifyWebhookRoutes, { prefix: '/api/v1/webhooks' });

  // Shopify OAuth callback (public — HMAC verified inside route)
  await app.register(shopifyRoutes, { prefix: '/api/v1' });

  // Dev-only auth login bypass (local/desktop client convenience — never runs in production)
  if (isDev) {
    app.post('/api/v1/auth/login', async (_request, reply) => {
      const internalSecret = process.env['INTERNAL_SECRET'];
      return reply.send({
        token: internalSecret,
        user: {
          id: 'admin_desktop_client',
          email: 'admin@scrollpop.local',
          name: 'Local Admin',
          role: 'admin',
        }
      });
    });
  }

  // Internal (called by Cloudflare Worker, auth via API_SECRET header)
  await app.register(internalRoutes, { prefix: '/api/v1/internal' });

  // Authenticated routes
  await app.register(meRoutes, { prefix: '/api/v1' });
  await app.register(siteRoutes, { prefix: '/api/v1' });
  await app.register(campaignRoutes, { prefix: '/api/v1' });
  await app.register(designRoutes, { prefix: '/api/v1' });
  await app.register(triggerRoutes, { prefix: '/api/v1' });
  await app.register(targetingRoutes, { prefix: '/api/v1' });
  await app.register(frequencyRoutes, { prefix: '/api/v1' });
  await app.register(analyticsRoutes, { prefix: '/api/v1' });
  await app.register(notificationRoutes, { prefix: '/api/v1' });
  await app.register(opsRoutes, { prefix: '/api/v1' });
  await app.register(adminRoutes, { prefix: '/api/v1' });
  await app.register(journeyRoutes, { prefix: '/api/v1' });
  await app.register(experimentRoutes, { prefix: '/api/v1' });
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
      const cacheKey = `sp_config:${publicKey}`;

      // 1. Check Redis Cache
      if (redis) {
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            return reply
              .type('application/json')
              .headers({
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
              })
              .send(cached);
          }
        } catch (err) {
          request.log.error(err, 'Redis cache read error');
        }
      }

      // 2. Look up site by public key
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

      // 3. Get all active campaigns for this site
      const activeCampaigns = await db.query.campaigns.findMany({
        where: and(
          eq(campaigns.siteId, site.id),
          eq(campaigns.status, 'active'),
          isNull(campaigns.deletedAt)
        ),
      });

      const campaignIds = activeCampaigns.map((c) => c.id);

      let campaignConfigs: any[] = [];

      if (campaignIds.length > 0) {
        // 4. Fetch all related entities in 4 concurrent queries (eliminating N+1)
        const { inArray } = await import('drizzle-orm');
        const [allDesigns, allTriggers, allTargeting, allFreq] = await Promise.all([
          db.query.designs.findMany({ where: inArray(designs.campaignId, campaignIds) }),
          db.query.triggers.findMany({ where: inArray(triggers.campaignId, campaignIds) }),
          db.query.targetingRules.findMany({ where: inArray(targetingRules.campaignId, campaignIds) }),
          db.query.frequencyRules.findMany({ where: inArray(frequencyRules.campaignId, campaignIds) }),
        ]);

        // Group by campaignId
        campaignConfigs = activeCampaigns.map((campaign) => {
          const design = allDesigns.find((d) => d.campaignId === campaign.id);
          if (!design) return null;

          const campaignTriggers = allTriggers.filter((t) => t.campaignId === campaign.id);
          const targeting = allTargeting.filter((r) => r.campaignId === campaign.id);
          const freq = allFreq.find((f) => f.campaignId === campaign.id);

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
        }).filter(Boolean);
      }

      const version = crypto
        .createHash('sha256')
        .update(JSON.stringify(campaignConfigs))
        .digest('hex')
        .slice(0, 8);

      const siteTenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, site.tenantId),
        columns: { plan: true },
      });

      const payload = {
        siteId: site.id,
        plan: siteTenant?.plan ?? 'free',
        campaigns: campaignConfigs,
        version,
      };

      // 5. Save to Redis Cache (60 second TTL)
      if (redis) {
        try {
          await redis.setex(cacheKey, 60, JSON.stringify(payload));
        } catch (err) {
          request.log.error(err, 'Redis cache write error');
        }
      }

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

  // ── Notification triggers (best-effort, fired from the event ingest path) ──────
  // Usage thresholds: notify once per calendar month when a tenant crosses 80% / 95%
  // of its monthly view limit. De-duplicated with a Redis NX flag (38-day TTL so it
  // self-clears next month). When 95% fires we also set the 80% flag so it can't
  // back-fire. Cheap: only runs on a 1-in-20 impression sample (see caller).
  async function checkUsageThresholds(tenantId: string, count: number, month: string): Promise<void> {
    if (!redis) return;
    try {
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
        columns: { monthlyViewLimit: true },
      });
      const limit = tenant?.monthlyViewLimit ?? 0;
      if (limit <= 0) return;
      const pct = count / limit;
      const ttl = 38 * 24 * 60 * 60;
      const flag80 = `sp_notif:u80:${tenantId}:${month}`;
      const flag95 = `sp_notif:u95:${tenantId}:${month}`;
      if (pct >= 0.95) {
        await redis.set(flag80, '1', { ex: ttl }); // suppress the lower threshold
        if (await redis.set(flag95, '1', { nx: true, ex: ttl })) {
          await emitNotification(tenantId, {
            type: 'notif_usage_95',
            title: "You've used 95% of your monthly views",
            body: `${count.toLocaleString()} of ${limit.toLocaleString()} views this month. Upgrade to keep popups live.`,
            href: '/billing',
          });
        }
      } else if (pct >= 0.8) {
        if (await redis.set(flag80, '1', { nx: true, ex: ttl })) {
          await emitNotification(tenantId, {
            type: 'notif_usage_80',
            title: "You've used 80% of your monthly views",
            body: `${count.toLocaleString()} of ${limit.toLocaleString()} views this month.`,
            href: '/billing',
          });
        }
      }
    } catch { /* best-effort */ }
  }

  // Conversion milestones: notify when cumulative conversions cross 100 / 1k / 10k / 100k.
  // The Redis counter is incremented atomically, so an exact-match on the new total
  // fires each milestone exactly once (counts from feature launch, not historically).
  async function checkConversionMilestone(tenantId: string): Promise<void> {
    if (!redis) return;
    try {
      const total = await redis.incr(`sp_conv:${tenantId}`);
      if (total === 100 || total === 1000 || total === 10000 || total === 100000) {
        await emitNotification(tenantId, {
          type: 'notif_conversion',
          title: `🎉 ${total.toLocaleString()} conversions!`,
          body: `Your campaigns just crossed ${total.toLocaleString()} total conversions.`,
          href: '/analytics',
        });
      }
    } catch { /* best-effort */ }
  }

  // 3. Local Ingest Route (Prevents fetch errors when snippet beacons analytics)
  app.post<{ Body: { events?: any[] } }>('/e', async (request, reply) => {
    const payload = request.body;
    if (payload && Array.isArray(payload.events)) {
      for (const rawEvt of payload.events) {
        const {
          campaignId, eventType, affiliateSlotId, visitorId, sessionId,
          device, pageUrl, referrer, country, metadata, meta,
          scrollDepthPct, trafficSource, abVariantId, shopifyOrderId, revenueCents,
        } = rawEvt;
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
              country: country || null,
              metadata: metadata ?? meta ?? {},
              scrollDepthPct: scrollDepthPct != null ? Number(scrollDepthPct) : null,
              trafficSource: trafficSource || null,
              abVariantId: abVariantId || null,
              shopifyOrderId: shopifyOrderId || null,
              revenueCents: revenueCents != null ? Number(revenueCents) : null,
            });

            // Increment monthly view counter in Redis for edge enforcement.
            // Only impressions count against the monthly view limit.
            if (eventType === 'impression' && redis) {
              const month = new Date().toISOString().slice(0, 7); // e.g. "2026-05"
              const key = `sp_views:${campaign.tenantId}:${month}`;
              try {
                const newCount = await redis.incr(key);
                // Keep the key alive through the end of the month + a 7-day buffer.
                await redis.expire(key, 38 * 24 * 60 * 60); // 38 days
                // Usage-threshold notifications — sampled 1-in-20 to bound DB load
                // (the warning only needs to land within ~20 views of the crossing).
                if (typeof newCount === 'number' && newCount % 20 === 0) {
                  void checkUsageThresholds(campaign.tenantId, newCount, month);
                }
              } catch { /* non-fatal — enforcement falls back to DB query */ }
            }

            // Conversion-milestone notifications.
            if (eventType === 'conversion') {
              void checkConversionMilestone(campaign.tenantId);
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // A missing monthly partition makes Postgres reject the row with
          // "no partition of relation \"events\" found". Surface it loudly — this is
          // the classic cause of analytics going silently empty at month rollover.
          if (msg.includes('no partition of relation')) {
            request.log.error(
              { err, eventType, campaignId },
              '[analytics] EVENT DROPPED — missing events partition for this month. Run ensureEventPartitions / create events_YYYY_MM in Neon.',
            );
          } else {
            request.log.error(err, 'Failed to insert analytic event');
          }
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

  // Ensure this month's (and next month's) events partition exists before serving.
  // Prevents the recurring "analytics silently dies at month rollover" outage on Neon,
  // where inserts for a missing partition are dropped with no error. Safe no-op locally.
  await ensureEventPartitions(app.log);
  // Ensure notifications schema (migration 0006) so notification_prefs / notifications
  // exist before serving — prevents tenant-lookup 500s if the migration wasn't applied.
  await ensureNotificationsSchema(app.log);

  const port = parseInt(process.env['PORT'] ?? '3001', 10);
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`API running on port ${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
