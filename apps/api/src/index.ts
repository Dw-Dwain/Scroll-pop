import Fastify from 'fastify';
import { clerkPlugin } from '@clerk/fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Redis } from '@upstash/redis';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { sanitizeEmailHtml } from './lib/email-html.js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, systemDb, sqlClient, rlsActive, disableRls } from './db/client.js';
import { ensureEventPartitions } from './db/ensure-partitions.js';
import { ensureRlsSchema } from './db/ensure-rls.js';
import { ensureNotificationsSchema } from './db/ensure-notifications.js';
import { ensureAuditLogSchema } from './db/ensure-audit-log.js';
import { ensureLeadsSchema } from './db/ensure-leads.js';
import { ensureVariantsSchema } from './db/ensure-variants.js';
import { ensureJourneysSchema } from './db/ensure-journeys.js';
import { ensureCouponsSchema } from './db/ensure-coupons.js';
import { ensureClientsSchema } from './db/ensure-clients.js';
import { ensureTeamInvitesSchema } from './db/ensure-team-invites.js';
import { ensureAffiliateLinksSchema } from './db/ensure-affiliate-links.js';
import { ensureWebhooksSchema } from './db/ensure-webhooks.js';
import { ensureIntegrationsSchema } from './db/ensure-integrations.js';
import { startDeletedDataPurge } from './db/purge-deleted.js';
import { sites, campaigns, designs, triggers, targetingRules, frequencyRules, events, tenants, leads, coupons } from './db/schema.js';
import { eq, and, isNull, sql as drizzleSql } from 'drizzle-orm';

// Routes
import { siteRoutes } from './routes/sites.js';
import { clientRoutes } from './routes/clients.js';
import { teamRoutes } from './routes/team.js';
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
import { leadRoutes } from './routes/leads.js';
import { variantRoutes } from './routes/variants.js';
import { couponRoutes } from './routes/coupons.js';
import { autoResponderRoutes } from './routes/auto-responder.js';
import { outboundWebhookRoutes, fireOutboundWebhook } from './routes/outbound-webhook.js';
import { integrationRoutes } from './routes/integrations.js';
import { espConfigRoutes } from './routes/esp-config.js';
import { dispatchToEsps } from './lib/esp.js';
import { decryptToken } from './lib/token-crypto.js';
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
import { captureException, sentryEnabled } from './lib/sentry.js';
import { sendEmail, emailEnabled } from './lib/email.js';

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
      // No-origin requests (curl, Postman, server-to-server) are allowed through, but they
      // get NO credentialed-CORS reflection — see the onSend hook below which only echoes
      // Access-Control-Allow-Credentials for an explicitly allow-listed Origin (M-5).
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin) || pagesPreviewPattern.test(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    // The dashboard authenticates with a Bearer JWT (Authorization header), not cookies, so the
    // API never needs to reflect credentials for a wildcard/no-origin request. @fastify/cors only
    // emits Allow-Credentials when the origin matched the allow-list above, so this stays scoped.
    credentials: true,
    // Explicitly allow the methods/headers the dashboard uses — the design editor
    // saves via PUT, which was missing from the default preflight allow-list.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
  });

  // Clerk auth
  await app.register(clerkPlugin);

  // Error handler
  await app.register(errorHandlerPlugin);

  // Tenant context (decodes Clerk JWT → req.tenantId, req.userId)
  await app.register(tenantContextPlugin);

  // Security response headers on every response (lightweight, no extra dep).
  // nosniff blocks MIME confusion on the served snippet JS + JSON; frame/referrer/HSTS
  // harden against clickjacking, referrer leakage, and protocol downgrade.
  app.addHook('onSend', async (_request, reply, payload) => {
    void reply.header('X-Content-Type-Options', 'nosniff');
    void reply.header('X-Frame-Options', 'DENY');
    void reply.header('Referrer-Policy', 'no-referrer');
    void reply.header('X-DNS-Prefetch-Control', 'off');
    // The API only ever serves JSON + the snippet JS bundle (never an HTML document of its
    // own), so a maximally strict CSP adds defence-in-depth with zero functional cost
    // (CTO-AUDIT Phase 4, Finding 11 / P2-1).
    void reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    if (!isDev) {
      void reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    return payload;
  });

  // Webhooks (no auth — use signature verification)
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  await app.register(shopifyWebhookRoutes, { prefix: '/api/v1/webhooks' });

  // Shopify OAuth callback (public — HMAC verified inside route)
  await app.register(shopifyRoutes, { prefix: '/api/v1' });

  // Internal (called by Cloudflare Worker, auth via X-Internal-Secret header)
  await app.register(internalRoutes, { prefix: '/api/v1/internal' });

  // Authenticated routes
  await app.register(meRoutes, { prefix: '/api/v1' });
  await app.register(siteRoutes, { prefix: '/api/v1' });
  await app.register(clientRoutes, { prefix: '/api/v1' });
  await app.register(teamRoutes, { prefix: '/api/v1' });
  await app.register(campaignRoutes, { prefix: '/api/v1' });
  await app.register(designRoutes, { prefix: '/api/v1' });
  await app.register(triggerRoutes, { prefix: '/api/v1' });
  await app.register(targetingRoutes, { prefix: '/api/v1' });
  await app.register(frequencyRoutes, { prefix: '/api/v1' });
  await app.register(analyticsRoutes, { prefix: '/api/v1' });
  await app.register(notificationRoutes, { prefix: '/api/v1' });
  await app.register(leadRoutes, { prefix: '/api/v1' });
  await app.register(variantRoutes, { prefix: '/api/v1' });
  await app.register(couponRoutes, { prefix: '/api/v1' });
  await app.register(autoResponderRoutes, { prefix: '/api/v1' });
  await app.register(outboundWebhookRoutes, { prefix: '/api/v1' });
  await app.register(integrationRoutes, { prefix: '/api/v1' });
  await app.register(espConfigRoutes, { prefix: '/api/v1' });
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
      // M-4: production serves the snippet from the Cloudflare CDN/Worker, never from the API.
      // Disable this dev-only route in prod so it isn't a second, un-cap-enforced surface.
      if (!isDev) return reply.code(404).send('Not found');
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
      // M-4: production config is served by the Cloudflare edge Worker (which enforces the
      // real-time monthly view cap + strips internal fields). This dev-only mirror skips both,
      // so it must not be reachable in prod.
      if (!isDev) return reply.code(404).send({ error: 'Not found' });
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
            // Match the edge serve path: merge the top-level `kind` column into the design object.
            design: { ...(design.config as Record<string, unknown>), kind: design.kind },
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
            frequency: {
              frequency: freq?.frequency ?? 'once_per_session',
              maxDisplayCount: freq?.maxDisplayCount ?? null,
              cooldownSeconds: freq?.cooldownSeconds ?? null,
              showAgainIfConverts: freq?.showAgainIfConverts ?? false,
            },
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
  // Counter is seeded from DB on first increment so milestones reflect historical totals,
  // not just conversions since feature launch (P3-12).
  async function checkConversionMilestone(tenantId: string): Promise<void> {
    if (!redis) return;
    try {
      let total = await redis.incr(`sp_conv:${tenantId}`);
      if (total === 1) {
        const [row] = await db
          .select({ count: drizzleSql<number>`count(*)::int` })
          .from(events)
          .where(and(eq(events.tenantId, tenantId), eq(events.eventType, 'conversion')));
        const historical = (row?.count ?? 0) as number;
        if (historical > 1) {
          await redis.set(`sp_conv:${tenantId}`, historical);
          total = historical;
        }
      }
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
  // Rate limit: 500 beacons/min per IP — well above any real page's traffic but blocks
  // floods from scrapers or misconfigured snippets hitting the API directly.
  // Keyed by IP (not tenant — the request has no auth header).
  // The Cloudflare Worker already throttles edge traffic; this is the direct-API guard.
  // ── Event field validation helpers ───────────────────────────────────────────
  const ALLOWED_EVENT_TYPES = new Set([
    'impression', 'view', 'click', 'dismiss', 'conversion',
    'popup_close', 'popup_submit', 'popup_expand', 'popup_minimize',
    'email_capture', 'sms_capture', 'discount_redeemed',
    'checkout_started', 'purchase_completed', 'trigger_fired', 'trigger_blocked',
  ]);
  const ALLOWED_DEVICES = new Set(['mobile', 'desktop', 'tablet']);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Max impressions counted per (campaign, client-IP) per minute. Real visitors generate ~1
  // per session (frequency-capped); anything above this is a flood, so we neither store it nor
  // count it toward the billing/view cap. This bounds quota-exhaustion abuse: forging a 2M-view
  // tenant over its limit would require thousands of distinct IPs, each capped here AND by the
  // global 500/min IP limit. Tune if a legitimate high-traffic single-egress customer trips it.
  const IMPRESSION_PER_IP_PER_MIN = 120;

  function sanitizeEventUrl(url: unknown): string | null {
    if (typeof url !== 'string' || url.length > 2048) return null;
    try {
      const p = new URL(url);
      return (p.protocol === 'https:' || p.protocol === 'http:') ? url : null;
    } catch { return null; }
  }

  // Resolve the real client IP. Only trust the forwarded CF-Connecting-IP header when the
  // request actually came from our Worker (proven by INTERNAL_SECRET) — otherwise a direct
  // caller to the public API could spoof the header to evade per-IP limits. Falls back to the
  // unspoofable socket IP for direct callers.
  function realClientIp(req: { headers: Record<string, unknown>; ip: string }): string {
    const fromWorker = req.headers['x-internal-secret'] === process.env['INTERNAL_SECRET'];
    if (fromWorker) {
      const fwd = req.headers['x-cf-connecting-ip'];
      if (typeof fwd === 'string' && fwd) return fwd;
    }
    return req.ip;
  }

  // In-process cache of campaignId → {tenant, site, site domains}. Eliminates a per-event DB
  // lookup on the hot ingest path (the API is always-warm on Render). Short TTL so deletes/moves
  // propagate. The site domains are carried so the ingest path can verify an event's origin.
  type CampaignMeta = {
    tenantId: string; siteId: string; platform: string;
    domain: string | null; shopifyShop: string | null; wpSiteUrl: string | null;
    customDomain: string | null;
  };
  const campaignMetaCache = new Map<string, CampaignMeta & { exp: number }>();
  async function resolveCampaignMeta(campaignId: string): Promise<CampaignMeta | null> {
    const now = Date.now();
    // L1: in-process Map (zero network latency)
    const hit = campaignMetaCache.get(campaignId);
    if (hit && hit.exp > now) return hit;

    // L2: Redis hash — shared across Render instances so a second instance doesn't cold-miss
    // every campaign on startup (P3-7). Falls through to DB on any Redis error.
    if (redis) {
      try {
        const h = await redis.hgetall(`sp_campaign_meta:${campaignId}`);
        // SR-12: require all three identity fields to be present strings. A partially
        // written hash (e.g. an HSET interrupted mid-write) would otherwise coerce an
        // undefined siteId/platform to the literal string "undefined" and cache it.
        if (h && typeof h['tenantId'] === 'string' &&
                 typeof h['siteId'] === 'string' &&
                 typeof h['platform'] === 'string') {
          const meta: CampaignMeta = {
            tenantId: h['tenantId'],
            siteId: h['siteId'],
            platform: h['platform'],
            domain: (h['domain'] as string) || null,
            shopifyShop: (h['shopifyShop'] as string) || null,
            wpSiteUrl: (h['wpSiteUrl'] as string) || null,
            customDomain: (h['customDomain'] as string) || null,
          };
          campaignMetaCache.set(campaignId, { ...meta, exp: now + 300_000 });
          return meta;
        }
      } catch { /* non-fatal — fall through to DB */ }
    }

    const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
    if (!campaign) return null;
    const site = await db.query.sites.findFirst({
      where: eq(sites.id, campaign.siteId),
      columns: { platform: true, domain: true, shopifyShop: true, wpSiteUrl: true, customDomain: true },
    });
    const meta: CampaignMeta = {
      tenantId: campaign.tenantId,
      siteId: campaign.siteId,
      platform: site?.platform ?? 'other',
      domain: site?.domain ?? null,
      shopifyShop: site?.shopifyShop ?? null,
      wpSiteUrl: site?.wpSiteUrl ?? null,
      customDomain: site?.customDomain ?? null,
    };

    // Write to Redis L2 + in-process L1
    if (redis) {
      try {
        // hset expects alternating key/value pairs — write each field individually
        await redis.hset(`sp_campaign_meta:${campaignId}`, {
          tenantId: meta.tenantId,
          siteId: meta.siteId,
          platform: meta.platform,
          domain: meta.domain ?? '',
          shopifyShop: meta.shopifyShop ?? '',
          wpSiteUrl: meta.wpSiteUrl ?? '',
          customDomain: meta.customDomain ?? '',
        });
        await redis.expire(`sp_campaign_meta:${campaignId}`, 300);
      } catch { /* non-fatal */ }
    }
    campaignMetaCache.set(campaignId, { ...meta, exp: now + 300_000 });
    // Bound memory by evicting the oldest entries one at a time, NOT clearing the whole map.
    // A full clear caused a thundering herd — every concurrent request then re-hit the DB at
    // once. Map iterates in insertion order, so the first key is the oldest. CTO-AUDIT P1-6.
    while (campaignMetaCache.size > 5000) {
      const oldest = campaignMetaCache.keys().next().value;
      if (oldest === undefined) break;
      campaignMetaCache.delete(oldest);
    }
    return meta;
  }

  // Origin allow-check: an event's pageUrl must plausibly originate from the campaign's own site.
  // The campaign UUID is visible to anyone in the served config, so without this a third party
  // could forge impressions/conversions to poison another tenant's analytics or burn their
  // monthly view quota (CTO-AUDIT Phase 4 Finding 3 / Phase 5 Scenarios 1, 2, 10 — P1-1, P1-3).
  // Fails OPEN when the site has no known domain or the URL is missing/unparseable, so legitimate
  // traffic is never dropped; the per-IP flood gate stays the primary quota control. Matching is
  // on the registrable (last-two-label) domain so www/locale subdomains pass.
  function registrableDomain(host: string): string {
    const labels = host.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
    return labels.length <= 2 ? labels.join('.') : labels.slice(-2).join('.');
  }
  // Pull a clean, valid email out of a conversion event's metadata for lead capture.
  // Rejects the snippet's anonymous placeholder and anything malformed. CTO-AUDIT P0-3.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function extractLeadEmail(md: unknown): string | null {
    if (!md || typeof md !== 'object') return null;
    const raw = (md as Record<string, unknown>)['email'];
    if (typeof raw !== 'string') return null;
    const email = raw.trim().toLowerCase();
    if (email.length < 3 || email.length > 254) return null;
    if (email === 'anonymous@scrollpop.online') return null;
    if (!EMAIL_RE.test(email)) return null;
    return email;
  }

  function eventOriginAllowed(pageUrl: string | null, meta: CampaignMeta): boolean {
    // SR-10: previously this auto-allowed every non-html/wordpress platform, letting an
    // attacker forge events against any Shopify/donation/"other" campaign whose UUID they
    // could read from the served config. Now we enforce against whatever domain we *do*
    // know (stored domain, Shopify shop, WP site URL) for every platform, and only fail
    // open when we genuinely have no known domain to check against. The per-IP flood gate
    // remains the primary quota control.
    if (!pageUrl) return true; // no URL to check — fail open
    let host: string;
    try { host = new URL(pageUrl).hostname; } catch { return true; }
    const target = registrableDomain(host);

    // Stored site domain (all platforms).
    if (meta.domain && registrableDomain(meta.domain) === target) return true;

    // Shopify: also accept the shop's myshopify.com host.
    if (meta.shopifyShop) {
      const shopHost = meta.shopifyShop.includes('.')
        ? meta.shopifyShop
        : `${meta.shopifyShop}.myshopify.com`;
      if (registrableDomain(shopHost) === target) return true;
    }

    // WordPress: also accept the configured site URL host.
    if (meta.wpSiteUrl) {
      try {
        const wpHost = meta.wpSiteUrl.includes('://')
          ? new URL(meta.wpSiteUrl).hostname
          : meta.wpSiteUrl;
        if (registrableDomain(wpHost) === target) return true;
      } catch { /* unparseable — ignore this candidate */ }
    }

    // Operator-registered custom/storefront domain (e.g. a Shopify store served on its own
    // domain instead of *.myshopify.com). Lets impression/conversion analytics through on
    // custom domains without weakening the gate for everyone.
    if (meta.customDomain) {
      try {
        const cdHost = meta.customDomain.includes('://')
          ? new URL(meta.customDomain).hostname
          : meta.customDomain;
        if (registrableDomain(cdHost) === target) return true;
      } catch { /* unparseable — ignore this candidate */ }
    }

    // No known domain of any kind — fail open so legitimate traffic is never dropped.
    if (!meta.domain && !meta.shopifyShop && !meta.wpSiteUrl && !meta.customDomain) return true;

    return false;
  }

  // In-memory fallback flood gate, used only when Redis is unavailable. Bounds per-IP
  // impressions per minute on this instance so a forged-event flood can't burn a tenant's
  // quota unbounded while Redis is down (previously this path failed fully open). Fixed
  // 60s window; entries are pruned opportunistically to cap memory.
  const memImpGate = new Map<string, { count: number; resetAt: number }>();
  function memImpressionWithinIpQuota(campaignId: string, ip: string): boolean {
    const now = Date.now();
    if (memImpGate.size > 50_000) {
      for (const [key, v] of memImpGate) if (now >= v.resetAt) memImpGate.delete(key);
    }
    const k = `${campaignId}:${ip}`;
    const e = memImpGate.get(k);
    if (!e || now >= e.resetAt) {
      memImpGate.set(k, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    e.count += 1;
    return e.count <= IMPRESSION_PER_IP_PER_MIN;
  }

  // Per-(campaign, IP) impression flood gate. Returns false once the per-minute cap is exceeded.
  // Prefers the Redis counter (shared across instances + reused for billing); falls back to the
  // in-memory gate when Redis is unavailable or errors, so the cap is still enforced per instance.
  async function impressionWithinIpQuota(campaignId: string, ip: string): Promise<boolean> {
    if (!redis) return memImpressionWithinIpQuota(campaignId, ip);
    try {
      const k = `sp_imp_gate:${campaignId}:${ip}`;
      const n = await redis.incr(k);
      if (n === 1) await redis.expire(k, 60);
      return typeof n !== 'number' || n <= IMPRESSION_PER_IP_PER_MIN;
    } catch { return memImpressionWithinIpQuota(campaignId, ip); }
  }

  app.post<{ Body: { events?: any[] } }>('/e', {
    config: {
      rateLimit: {
        max: 500,
        timeWindow: '1 minute',
        keyGenerator: (req) => realClientIp(req as any),
        errorResponseBuilder: (_req, context) => ({
          error: {
            code: 'RATE_LIMITED',
            message: `Event ingest rate limit exceeded. Retry after ${context.after}.`,
          },
        }),
      },
    },
  }, async (request, reply) => {
    const clientIp = realClientIp(request as any);
    // Only the Cloudflare Worker (proven by INTERNAL_SECRET) is trusted to supply the
    // visitor's country — a direct caller could otherwise forge geo analytics (P2-3).
    const fromWorker = request.headers['x-internal-secret'] === process.env['INTERNAL_SECRET'];
    const payload = request.body;
    if (payload && Array.isArray(payload.events)) {
      for (const rawEvt of payload.events) {
        const {
          campaignId, eventType, affiliateSlotId, visitorId, sessionId,
          device, pageUrl, referrer, country, metadata, meta,
          scrollDepthPct, trafficSource, abVariantId, shopifyOrderId, revenueCents,
        } = rawEvt;
        if (!campaignId || !eventType) continue;

        // Validate and sanitize fields before insert
        if (!ALLOWED_EVENT_TYPES.has(eventType)) continue;
        const safeDevice = typeof device === 'string' && ALLOWED_DEVICES.has(device) ? device : null;
        const safePageUrl = sanitizeEventUrl(pageUrl);
        const safeReferrer = typeof referrer === 'string' && referrer.length <= 2048 ? referrer : null;
        // Visitor/session IDs must be UUIDs (the snippet emits crypto.randomUUID()). Reject
        // arbitrary strings so attackers can't inflate unique-visitor counts with junk IDs.
        const safeVisitorId = typeof visitorId === 'string' && UUID_RE.test(visitorId) ? visitorId : null;
        const safeSessionId = typeof sessionId === 'string' && UUID_RE.test(sessionId) ? sessionId : null;
        // L-3: revenue is authoritative only from the Shopify orders/paid webhook (which inserts
        // server-side, not via /e). A direct caller to /e could otherwise inflate revenue
        // analytics up to the clamp. Only accept client-supplied revenue when the event was
        // forwarded by our own edge Worker; drop it for direct public callers.
        const safeRevenueCents = (fromWorker && revenueCents != null)
          ? Math.min(Math.max(0, Math.round(Number(revenueCents))), 1_000_000)
          : null;
        const safeScrollDepth = scrollDepthPct != null
          ? Math.min(Math.max(0, Math.round(Number(scrollDepthPct))), 100)
          : null;

        try {
          const campaign = await resolveCampaignMeta(campaignId);

          if (campaign) {
            // Origin gate: drop impressions/conversions whose page origin doesn't match the
            // campaign's own site. Blocks cross-tenant analytics poisoning + quota-burn from
            // forged events (the campaign UUID is public in the served config). Fails open.
            if ((eventType === 'impression' || eventType === 'conversion') &&
                !eventOriginAllowed(safePageUrl, campaign)) {
              continue;
            }

            // Impression flood gate: drop impressions that exceed the per-IP-per-campaign cap so
            // forged floods can neither poison analytics nor burn the tenant's monthly view quota.
            if (eventType === 'impression' && !(await impressionWithinIpQuota(campaignId, clientIp))) {
              continue;
            }

            await db.insert(events).values({
              tenantId: campaign.tenantId,
              siteId: campaign.siteId,
              campaignId,
              eventType,
              affiliateSlotId: affiliateSlotId || null,
              visitorId: safeVisitorId,
              sessionId: safeSessionId,
              device: safeDevice,
              pageUrl: safePageUrl,
              referrer: safeReferrer,
              country: fromWorker ? (country || null) : null,
              metadata: metadata ?? meta ?? {},
              scrollDepthPct: safeScrollDepth,
              trafficSource: trafficSource || null,
              abVariantId: abVariantId || null,
              shopifyOrderId: shopifyOrderId || null,
              revenueCents: safeRevenueCents,
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

            // Lead capture: a `conversion` OR an `email_capture` may carry the visitor's submitted
            // email. Persist it as a lead, deduped per (tenant, campaign, email) via
            // onConflictDoNothing (so saving on both event types for one submit is a no-op).
            // CRITICAL: `email_capture` is NOT subject to the origin gate above, so leads are saved
            // even when the popup is served on a Shopify custom domain (e.g. sakananet.com vs the
            // registered *.myshopify.com) or any host whose serving domain isn't in the site's
            // known-domain list. Previously leads only saved on `conversion`, which the origin gate
            // dropped on those domains — so lead capture silently failed. Best-effort — never break
            // ingest. CTO-AUDIT P0-3.
            if (eventType === 'conversion' || eventType === 'email_capture') {
              const md = (metadata ?? meta ?? {}) as Record<string, unknown>;
              const leadEmail = extractLeadEmail(md);
              if (leadEmail) {
                const leadName = typeof md['name'] === 'string' ? (md['name'] as string).slice(0, 200) : null;
                void db.insert(leads).values({
                  tenantId: campaign.tenantId,
                  siteId: campaign.siteId,
                  campaignId,
                  email: leadEmail,
                  name: leadName,
                  visitorId: safeVisitorId,
                  sessionId: safeSessionId,
                  source: trafficSource || null,
                  pageUrl: safePageUrl,
                }).onConflictDoNothing().catch(() => { /* best-effort */ });
              }
            }

            // Email auto-responder: on email_capture, send the operator-configured reply
            // if enabled. Best-effort — never fail the ingest. P2-13.
            if (eventType === 'email_capture' && emailEnabled()) {
              void (async () => {
                try {
                  const cam = await db.query.campaigns.findFirst({
                    where: eq(campaigns.id, campaignId),
                    columns: { autoResponder: true },
                  });
                  const ar = cam?.autoResponder as Record<string, unknown> | null;
                  if (ar?.['enabled'] === true) {
                    const md2 = (metadata ?? meta ?? {}) as Record<string, unknown>;
                    const recipientEmail = extractLeadEmail(md2);
                    if (recipientEmail) {
                      const subject = typeof ar['subject'] === 'string' && ar['subject']
                        ? ar['subject'] : 'Thank you for subscribing!';
                      const rawHtml = typeof ar['htmlBody'] === 'string' && ar['htmlBody']
                        ? ar['htmlBody'] : '<p>Thanks for joining our list — we\'ll be in touch!</p>';
                      // SR-07: the htmlBody is operator-supplied (stored JSONB, up to 50KB)
                      // and goes straight to subscribers' inboxes. Strip to an allowlist so a
                      // malicious/compromised operator can't deliver <script>, tracking pixels,
                      // or phishing markup as stored XSS in outbound email.
                      const htmlBody = sanitizeEmailHtml(rawHtml);
                      await sendEmail({ to: recipientEmail, subject, html: htmlBody });
                    }
                  }
                } catch { /* best-effort */ }
              })();
            }

            // ESP sync: on email_capture, forward lead to Klaviyo / Mailchimp if configured.
            // P1-8 (Klaviyo) + P1-9 (Mailchimp). Best-effort — never blocks ingest.
            if (eventType === 'email_capture') {
              void (async () => {
                try {
                  const md5 = (metadata ?? meta ?? {}) as Record<string, unknown>;
                  const leadEmail = extractLeadEmail(md5);
                  if (!leadEmail) return;

                  // Batch-load campaign esp_config + tenant integrations in one query each
                  const espCam = await db.query.campaigns.findFirst({
                    where: eq(campaigns.id, campaignId),
                    columns: { espConfig: true, tenantId: true },
                  });
                  if (!espCam) return;

                  const espTenant = await db.query.tenants.findFirst({
                    where: eq(tenants.id, espCam.tenantId),
                    columns: { integrations: true },
                  });
                  if (!espTenant) return;

                  const fullName = typeof md5['name'] === 'string' ? (md5['name'] as string) : null;
                  const contact: { email: string; firstName?: string | undefined; lastName?: string | undefined } = {
                    email: leadEmail,
                    ...(fullName ? { firstName: fullName.split(' ')[0] } : {}),
                    ...(fullName?.includes(' ') ? { lastName: fullName.split(' ').slice(1).join(' ') } : {}),
                  };

                  // ESP API keys are stored encrypted at rest (M-1) — decrypt before use.
                  // decryptToken passes legacy plaintext through unchanged.
                  const rawIntegrations = (espTenant.integrations ?? {}) as Record<string, { apiKey?: string } | undefined>;
                  const dec = (p?: { apiKey?: string }) =>
                    p ? { ...p, apiKey: p.apiKey ? decryptToken(p.apiKey) : undefined } : undefined;
                  const integrations = {
                    klaviyo: dec(rawIntegrations['klaviyo']),
                    mailchimp: dec(rawIntegrations['mailchimp']),
                  } as Parameters<typeof dispatchToEsps>[0];

                  await dispatchToEsps(
                    integrations,
                    (espCam.espConfig ?? {}) as Parameters<typeof dispatchToEsps>[1],
                    contact,
                  );
                } catch { /* best-effort */ }
              })();
            }

            // Outbound webhook: fire for email_capture and conversion (configurable). P2-14.
            if (eventType === 'email_capture' || eventType === 'conversion' ||
                eventType === 'click' || eventType === 'dismiss') {
              void (async () => {
                try {
                  const wCam = await db.query.campaigns.findFirst({
                    where: eq(campaigns.id, campaignId),
                    columns: { outboundWebhook: true },
                  });
                  if (wCam?.outboundWebhook) {
                    const md4 = (metadata ?? meta ?? {}) as Record<string, unknown>;
                    await fireOutboundWebhook({
                      config: wCam.outboundWebhook as Record<string, unknown>,
                      event: eventType as 'email_capture' | 'conversion' | 'click' | 'dismiss',
                      campaignId,
                      tenantId: campaign.tenantId,
                      data: {
                        // Spread raw client metadata FIRST so the server-sanitized fields below
                        // always win. (Previously ...md4 came last, letting a forged /e event
                        // override email/pageUrl/revenueCents with spoofed values in the payload
                        // delivered to the operator's webhook/CRM.) Explicit `undefined` here
                        // overrides any raw key and is dropped by JSON.stringify.
                        ...md4,
                        email: extractLeadEmail(md4) ?? undefined,
                        pageUrl: safePageUrl ?? undefined,
                        visitorId: safeVisitorId ?? undefined,
                        device: safeDevice ?? undefined,
                        revenueCents: safeRevenueCents ?? undefined,
                      },
                    });
                  }
                } catch { /* best-effort */ }
              })();
            }

            // Coupon validation: on discount_redeemed, verify the code is valid for this
            // tenant and hasn't exceeded its use limit, then increment. P3-9.
            if (eventType === 'discount_redeemed') {
              const md3 = (metadata ?? meta ?? {}) as Record<string, unknown>;
              const couponCode = typeof md3['coupon_code'] === 'string' ? md3['coupon_code'].trim().toUpperCase() : null;
              if (couponCode) {
                void (async () => {
                  try {
                    // SR-06: a separate read-then-increment lets concurrent duplicate
                    // events both pass the `uses < maxUses` guard and both increment,
                    // pushing the count past maxUses (a single-use coupon redeemed twice).
                    // Do the guard and the increment atomically in one UPDATE … WHERE and
                    // reject when 0 rows are affected.
                    const redeemed = await db.update(coupons)
                      .set({ uses: drizzleSql`${coupons.uses} + 1` })
                      .where(and(
                        eq(coupons.tenantId, campaign.tenantId),
                        eq(coupons.code, couponCode),
                        drizzleSql`(${coupons.maxUses} IS NULL OR ${coupons.uses} < ${coupons.maxUses})`,
                        drizzleSql`(${coupons.expiresAt} IS NULL OR ${coupons.expiresAt} > NOW())`,
                      ))
                      .returning({ id: coupons.id });
                    if (redeemed.length === 0) return; // unknown, expired, or exhausted — atomic
                  } catch { /* best-effort — never block ingest */ }
                })();
              }
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
        // Public, unauthenticated beacon endpoint — wildcard origin, NO credentials. Echoing
        // Allow-Credentials:true alongside ACAO:* is a misconfiguration browsers reject; the
        // /e path never needs cookies, so it's removed (M-5).
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      .send({ received: true });
  });

  // Health check
  app.get('/health', async () => ({ ok: true }));

  // ensure-*.ts scripts run idempotent DDL on every cold start, adding latency. Cache
  // a Redis flag after first successful run so warm restarts in the same deployment skip
  // them entirely (P3-11). Bump SCHEMA_VERSION whenever a new ensure-* call is added.
  const SCHEMA_VERSION = '20'; // v20: sites.affiliate_links column (per-site saved affiliate links)
  const schemaBootKey = `sp_schema_v${SCHEMA_VERSION}`;
  const schemaAlreadyRan = redis
    ? await redis.get(schemaBootKey).catch(() => null)
    : null;

  // Apply formal Drizzle migrations on boot. This REPLACES the Fly `release_command` (which ran
  // drizzle-kit migrate in a release machine that hung holding a single connection → "machine never
  // reached state destroyed" → every deploy aborted). A Postgres advisory lock held on a reserved
  // connection serializes machines so only one applies; the rest find them applied and no-op.
  // NON-FATAL: a failure here never blocks boot — the idempotent ensure-* self-heal below still
  // converges the schema. Runs on the system pool (superuser) so RLS can't interfere.
  {
    const MIGRATE_LOCK = 472701; // app-specific advisory lock key
    let lockConn: Awaited<ReturnType<typeof sqlClient.reserve>> | null = null;
    try {
      lockConn = await sqlClient.reserve();
      // NON-blocking: if another machine already holds the lock it's mid-migrate, so we skip rather
      // than block boot. A hard timeout means a hung migrate can never stall the app from listening.
      const rows = await lockConn`SELECT pg_try_advisory_lock(${MIGRATE_LOCK}) AS locked`;
      if (rows[0]?.['locked']) {
        const folder = fileURLToPath(new URL('../drizzle/migrations', import.meta.url));
        await Promise.race([
          migrate(systemDb, { migrationsFolder: folder }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('boot migrate timed out (90s)')), 90_000)),
        ]);
        app.log.info('[migrate] Drizzle migrations applied (boot)');
      } else {
        app.log.info('[migrate] another machine holds the migrate lock — skipping (it applies them)');
      }
    } catch (err) {
      app.log.error({ err }, '[migrate] boot migrate failed — continuing; ensure-* self-heal covers schema');
    } finally {
      if (lockConn) {
        try { await lockConn`SELECT pg_advisory_unlock(${MIGRATE_LOCK})`; } catch { /* ignore */ }
        try { lockConn.release(); } catch { /* ignore */ }
      }
    }
  }

  // Partition creation is TIME-sensitive: next month's events partition must exist before
  // the calendar rollover, so this runs on EVERY boot and is deliberately NOT gated behind
  // the schema-version skip flag. A warm restart inside the 24h skip window that straddled a
  // month boundary would otherwise skip creating the next partition, and inserts for the new
  // month would be silently dropped ("analytics dies at month rollover"). It's an idempotent
  // cheap no-op when the partitions already exist. Safe no-op locally.
  await ensureEventPartitions(app.log);

  // Row-level security (C-1). Runs on EVERY boot when active (not gated behind the schema-skip
  // flag) so policy changes always converge; the DDL is idempotent. FAIL-SAFE: if setup fails for
  // any reason, disable enforcement and continue app-layer-only — never crash the boot.
  if (rlsActive()) {
    try {
      const okRls = await ensureRlsSchema(app.log);
      if (!okRls) disableRls('ensureRlsSchema returned false');
    } catch (err) {
      app.log.error({ err }, '[rls] ensureRlsSchema threw — continuing app-layer-only');
      disableRls('ensureRlsSchema threw');
    }
  }

  if (schemaAlreadyRan) {
    app.log.info('[schema] ensure-* scripts skipped (already ran this version)');
  } else {
    // Ensure notifications schema (migration 0006).
    await ensureNotificationsSchema(app.log);
    // Ensure admin_audit_log schema (migration 0007).
    await ensureAuditLogSchema(app.log);
    // Ensure leads schema (migration 0009).
    await ensureLeadsSchema(app.log);
    // Ensure variants schema (migration 0010).
    await ensureVariantsSchema(app.log);
    // Ensure coupons + auto_responder + spin_wheel (migration 0011).
    await ensureCouponsSchema(app.log);
    // Ensure outbound_webhook column on campaigns (migration 0012, P2-14).
    await ensureWebhooksSchema(app.log);
    // Ensure integrations column on tenants + esp_config on campaigns (migration 0013, P1-8/P1-9).
    await ensureIntegrationsSchema(app.log);
    // Ensure agency clients table + sites.client_id (multi-client layer).
    await ensureClientsSchema(app.log);
    // Ensure agency team_invites table (coupled-login layer).
    await ensureTeamInvitesSchema(app.log);
    // Ensure journeys graph tables + self-contained RLS (migration 0015).
    await ensureJourneysSchema(app.log);
    // Ensure sites.affiliate_links column (per-site saved affiliate links).
    await ensureAffiliateLinksSchema(app.log);

    if (redis) {
      // 24h TTL — long enough to cover normal redeploys, short enough that a schema version
      // bump propagates within a day even if Redis isn't explicitly flushed.
      await redis.set(schemaBootKey, '1', { ex: 86400 }).catch(() => {});
    }
  }

  const port = parseInt(process.env['PORT'] ?? '3001', 10);
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`API running on port ${port}`);

  // Deleted-data lifecycle: hard-delete analytics events for campaigns/sites soft-deleted
  // >24h ago (after the download grace window). In-process hourly job; no external cron.
  startDeletedDataPurge(app.log);
}

// Last-resort error reporting to Sentry (no-op until SENTRY_DSN is set). Log and report,
// but don't exit on unhandledRejection — Fastify keeps serving; an uncaught synchronous
// exception is genuinely unsafe so we report then exit non-zero (Render restarts the instance).
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  void captureException(reason, { kind: 'unhandledRejection' });
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  void captureException(err, { kind: 'uncaughtException' });
});

bootstrap()
  .then(() => {
    if (sentryEnabled()) console.log('[sentry] error reporting enabled');
  })
  .catch((err) => {
    console.error(err);
    void captureException(err, { kind: 'bootstrap' });
    process.exit(1);
  });
