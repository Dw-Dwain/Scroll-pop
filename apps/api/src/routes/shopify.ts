/**
 * Shopify OAuth 2.0 + Mandatory Webhook Routes
 *
 * Flow:
 *  1. Dashboard calls POST /api/v1/shopify/install  (authenticated)
 *     → Returns { oauthUrl } to redirect the merchant to Shopify's permission screen
 *  2. Shopify redirects to GET /api/v1/shopify/callback?code=xxx&hmac=xxx&shop=xxx&state=xxx
 *     → Validates HMAC + nonce, exchanges code for offline access token,
 *       creates site record + script tag, redirects merchant to dashboard
 *
 * Webhooks (no auth — HMAC verified):
 *  - POST /api/v1/webhooks/shopify/app/uninstalled
 *  - POST /api/v1/webhooks/shopify/shop/redact          (GDPR)
 *  - POST /api/v1/webhooks/shopify/customers/redact     (GDPR)
 *  - POST /api/v1/webhooks/shopify/customers/data_request (GDPR)
 *
 * Additional authenticated routes:
 *  - GET  /api/v1/shopify/status?shop=xxx
 *  - DELETE /api/v1/shopify/disconnect (body: { shop })
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';
import { db } from '../db/client.js';
import { shopifyInstallations, sites, tenants, events } from '../db/schema.js';
import { eq, and, isNull, gte, desc } from 'drizzle-orm';
import { redis } from '../index.js';
import { encryptToken, decryptToken } from '../lib/token-crypto.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getConfig() {
  const apiKey = process.env['SHOPIFY_API_KEY'];
  const apiSecret = process.env['SHOPIFY_API_SECRET'];
  const scopes = process.env['SHOPIFY_SCOPES'] ?? 'read_products,write_script_tags';
  const dashboardUrl = process.env['DASHBOARD_URL'] ?? 'https://dashboard.scrollpop.online';
  const apiBaseUrl = process.env['API_BASE_URL'] ?? 'https://scrollpop-api.fly.dev';

  if (!apiKey || !apiSecret) {
    throw new Error('SHOPIFY_API_KEY and SHOPIFY_API_SECRET must be set');
  }
  return { apiKey, apiSecret, scopes, dashboardUrl, apiBaseUrl };
}

/** Validate HMAC from Shopify OAuth redirect query params */
function validateOAuthHmac(query: Record<string, string>, secret: string): boolean {
  const { hmac, ...rest } = query;
  if (!hmac) return false;

  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('&');

  const digest = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  const a = Buffer.from(digest);
  const b = Buffer.from(hmac);
  // timingSafeEqual throws on length mismatch — guard so a bad hmac is rejected, not a 500.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Validate HMAC from Shopify webhook header */
function validateWebhookHmac(rawBody: Buffer, secret: string, sentHmac: string): boolean {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sentHmac));
  } catch {
    return false;
  }
}

/** Shopify myshopify.com domain validator */
function isValidShopDomain(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

/** Call Shopify Admin REST API */
async function shopifyRequest(
  shop: string,
  accessToken: string,
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = `https://${shop}/admin/api/2024-10${path}`;
  const init: RequestInit = {
    method,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** Register a Shopify webhook via Admin API */
async function registerWebhook(
  shop: string,
  accessToken: string,
  topic: string,
  callbackUrl: string
): Promise<void> {
  const result = await shopifyRequest(shop, accessToken, 'POST', '/webhooks.json', {
    webhook: { topic, address: callbackUrl, format: 'json' },
  });
  if (!result.ok) {
    // Non-fatal: log but don't throw (webhook may already be registered)
    console.warn(`[shopify] Failed to register webhook ${topic}:`, result.data);
  }
}

// ── Nonce storage via Redis ───────────────────────────────────────────────────

const NONCE_TTL_SECONDS = 600; // 10 minutes

async function storeNonce(nonce: string, tenantId: string): Promise<void> {
  const key = `shopify_nonce:${nonce}`;
  if (redis) {
    await redis.setex(key, NONCE_TTL_SECONDS, tenantId);
  }
  // In dev without Redis, nonce is encoded in state so we decode it from there
}

async function consumeNonce(nonce: string): Promise<string | null> {
  const key = `shopify_nonce:${nonce}`;
  if (redis) {
    const tenantId = await redis.get<string>(key);
    if (tenantId) {
      await redis.del(key);
      return tenantId;
    }
    return null;
  }
  // Redis unavailable: allow in dev (nonce extracted from state)
  return null;
}

// ── Route plugin ─────────────────────────────────────────────────────────────

export const shopifyRoutes: FastifyPluginAsync = async (fastify) => {

  // ── POST /api/v1/shopify/install ─────────────────────────────────────────
  // Authenticated. Generates the Shopify OAuth permission URL.
  fastify.post('/shopify/install', async (request, reply) => {
    const body = z.object({
      shop: z.string().min(1),
    }).parse(request.body);

    const shop = body.shop.toLowerCase().trim();
    if (!isValidShopDomain(shop)) {
      return reply.code(400).send({
        error: { code: 'INVALID_SHOP', message: 'Invalid Shopify shop domain. Expected format: mystore.myshopify.com' },
      });
    }

    const config = getConfig();

    // Generate cryptographically secure nonce
    const nonce = crypto.randomBytes(16).toString('hex');
    // Encode tenantId into state so callback can resolve it even without Redis
    const state = Buffer.from(JSON.stringify({ nonce, tenantId: request.tenantId })).toString('base64url');

    // Also store in Redis for extra security
    await storeNonce(nonce, request.tenantId).catch(() => {});

    const redirectUri = `${config.apiBaseUrl}/api/v1/shopify/callback`;
    const oauthUrl =
      `https://${shop}/admin/oauth/authorize` +
      `?client_id=${config.apiKey}` +
      `&scope=${encodeURIComponent(config.scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}`;

    return reply.send({ data: { oauthUrl, shop } });
  });

  // ── GET /api/v1/shopify/callback ─────────────────────────────────────────
  // Public (called by Shopify redirect). No Clerk auth — verified by HMAC + nonce.
  // Rate limited: legitimate merchants hit this once per install, so 20/min per IP
  // is generous while blocking floods of crafted HMAC-invalid callback requests (T9).
  fastify.get('/shopify/callback', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
        keyGenerator: (req) => req.ip,
        errorResponseBuilder: (_req, context) => ({
          error: {
            code: 'RATE_LIMITED',
            message: `Too many OAuth callback attempts. Retry after ${context.after}.`,
          },
        }),
      },
    },
  }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { code, shop, state, timestamp } = query;

    if (!code || !shop || !state || !query.hmac) {
      return reply.code(400).send({ error: { code: 'MISSING_PARAMS', message: 'Missing required OAuth parameters' } });
    }

    // 1. Validate shop domain
    if (!isValidShopDomain(shop)) {
      return reply.code(400).send({ error: { code: 'INVALID_SHOP', message: 'Invalid shop domain' } });
    }

    // 2. Validate timestamp is recent (within 5 minutes)
    const ts = parseInt(timestamp ?? '0', 10);
    if (Math.abs(Date.now() / 1000 - ts) > 300) {
      return reply.code(400).send({ error: { code: 'EXPIRED', message: 'Request timestamp expired' } });
    }

    let config: ReturnType<typeof getConfig>;
    try {
      config = getConfig();
    } catch (err) {
      return reply.code(500).send({ error: { code: 'CONFIG_ERROR', message: 'Shopify integration not configured' } });
    }

    // 3. Validate HMAC
    if (!validateOAuthHmac(query, config.apiSecret)) {
      return reply.code(403).send({ error: { code: 'INVALID_HMAC', message: 'HMAC validation failed' } });
    }

    // 4. Decode state → tenantId + nonce
    let tenantId: string;
    let nonce: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { nonce: string; tenantId: string };
      tenantId = decoded.tenantId;
      nonce = decoded.nonce;
    } catch {
      return reply.code(400).send({ error: { code: 'INVALID_STATE', message: 'Invalid state parameter' } });
    }

    // 5. Verify nonce from Redis (if available) to prevent CSRF
    if (redis) {
      const storedTenantId = await consumeNonce(nonce).catch(() => null);
      if (storedTenantId && storedTenantId !== tenantId) {
        return reply.code(403).send({ error: { code: 'NONCE_MISMATCH', message: 'State/nonce mismatch' } });
      }
    }

    // 6. Verify tenant exists
    const tenant = await db.query.tenants.findFirst({
      where: and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)),
    });
    if (!tenant) {
      return reply.code(403).send({ error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' } });
    }

    // 7. Exchange authorization code for offline access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.apiKey,
        client_secret: config.apiSecret,
        code,
      }),
    });

    if (!tokenRes.ok) {
      request.log.error({ shop, status: tokenRes.status }, 'Shopify token exchange failed');
      return reply.code(502).send({ error: { code: 'TOKEN_EXCHANGE_FAILED', message: 'Failed to exchange authorization code' } });
    }

    const tokenData = await tokenRes.json() as { access_token: string; scope: string };
    const { access_token: accessToken, scope } = tokenData;

    if (!accessToken) {
      return reply.code(502).send({ error: { code: 'NO_TOKEN', message: 'No access token in response' } });
    }

    // 8. Upsert or create a Site record for this shop
    const shopDomain = shop.replace('.myshopify.com', '');
    let site = await db.query.sites.findFirst({
      where: and(eq(sites.tenantId, tenantId), eq(sites.domain, shop), isNull(sites.deletedAt)),
    });

    if (!site) {
      const [newSite] = await db.insert(sites).values({
        tenantId,
        name: shopDomain,
        domain: shop,
        platform: 'shopify',
        shopifyShop: shop,
        verifiedAt: new Date(),
      }).returning();
      site = newSite;
    } else {
      const [updated] = await db.update(sites)
        .set({ platform: 'shopify', shopifyShop: shop, verifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(sites.id, site.id))
        .returning();
      site = updated;
    }

    if (!site) {
      return reply.code(500).send({ error: { code: 'SITE_ERROR', message: 'Failed to create site record' } });
    }

    // 9. Upsert shopify_installations record (token encrypted at rest)
    const encryptedToken = encryptToken(accessToken);
    const existing = await db.query.shopifyInstallations.findFirst({
      where: eq(shopifyInstallations.shop, shop),
    });

    let installation: typeof shopifyInstallations.$inferSelect;
    if (existing) {
      const [updated] = await db.update(shopifyInstallations)
        .set({
          tenantId,
          siteId: site.id,
          accessToken: encryptedToken,
          scope,
          uninstalledAt: null,
          nonce,
          updatedAt: new Date(),
          installedAt: new Date(),
        })
        .where(eq(shopifyInstallations.shop, shop))
        .returning();
      installation = updated!;
    } else {
      const [newInstall] = await db.insert(shopifyInstallations).values({
        tenantId,
        siteId: site.id,
        shop,
        accessToken: encryptedToken,
        scope,
        nonce,
        installedAt: new Date(),
      }).returning();
      installation = newInstall!;
    }

    // 10. Inject Script Tag (async — non-blocking for the OAuth redirect)
    const cdnUrl = process.env['SNIPPET_CDN_URL'] ?? 'https://cdn.scrollpop.online';
    const scriptTagSrc = `${cdnUrl}/v1/${site.publicKey}/p.js`;

    try {
      // Remove stale script tags first
      const listResult = await shopifyRequest(shop, accessToken, 'GET', '/script_tags.json');
      if (listResult.ok) {
        const existing_tags = (listResult.data as any)?.script_tags ?? [];
        for (const tag of existing_tags) {
          if ((tag.src as string).includes('scrollpop')) {
            await shopifyRequest(shop, accessToken, 'DELETE', `/script_tags/${tag.id}.json`);
          }
        }
      }

      const tagResult = await shopifyRequest(shop, accessToken, 'POST', '/script_tags.json', {
        script_tag: { event: 'onload', src: scriptTagSrc },
      });

      if (tagResult.ok) {
        const tagId = String((tagResult.data as any)?.script_tag?.id ?? '');
        await db.update(shopifyInstallations)
          .set({ scriptTagId: tagId, updatedAt: new Date() })
          .where(eq(shopifyInstallations.id, installation.id));
      }
    } catch (err) {
      request.log.warn({ err, shop }, 'Script tag injection failed — proceeding anyway');
    }

    // 11. Register mandatory webhooks
    const webhookBase = `${config.apiBaseUrl}/api/v1/webhooks/shopify`;
    const webhooks = [
      { topic: 'app/uninstalled',           address: `${webhookBase}/app/uninstalled` },
      { topic: 'shop/redact',               address: `${webhookBase}/shop/redact` },
      { topic: 'customers/redact',          address: `${webhookBase}/customers/redact` },
      { topic: 'customers/data_request',    address: `${webhookBase}/customers/data_request` },
    ];

    await Promise.allSettled(
      webhooks.map((w) => registerWebhook(shop, accessToken, w.topic, w.address))
    );

    // 12. Redirect to dashboard with success indicator
    const dashboardRedirect = `${config.dashboardUrl}/sites?shopify_connected=1&shop=${encodeURIComponent(shop)}`;
    return reply.redirect(dashboardRedirect, 302);
  });

  // ── GET /api/v1/shopify/status ─────────────────────────────────────────
  fastify.get('/shopify/status', async (request, reply) => {
    const query = request.query as { shop?: string };
    if (!query.shop) {
      // Return all installations for this tenant
      const installations = await db.query.shopifyInstallations.findMany({
        where: and(
          eq(shopifyInstallations.tenantId, request.tenantId),
        ),
        columns: {
          id: true, shop: true, scope: true, installedAt: true, uninstalledAt: true,
          siteId: true, scriptTagId: true, createdAt: true,
        },
      });
      return reply.send({ data: installations });
    }

    const installation = await db.query.shopifyInstallations.findFirst({
      where: and(
        eq(shopifyInstallations.shop, query.shop),
        eq(shopifyInstallations.tenantId, request.tenantId),
      ),
      columns: {
        id: true, shop: true, scope: true, installedAt: true, uninstalledAt: true,
        siteId: true, scriptTagId: true, createdAt: true,
      },
    });

    if (!installation) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Shopify installation not found' } });
    }

    return reply.send({ data: installation });
  });

  // ── DELETE /api/v1/shopify/disconnect ────────────────────────────────────
  fastify.delete('/shopify/disconnect', async (request, reply) => {
    const body = z.object({ shop: z.string() }).parse(request.body);

    const installation = await db.query.shopifyInstallations.findFirst({
      where: and(
        eq(shopifyInstallations.shop, body.shop),
        eq(shopifyInstallations.tenantId, request.tenantId),
      ),
    });

    if (!installation) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Installation not found' } });
    }

    // Remove script tag from Shopify (decrypt token for API call)
    if (installation.scriptTagId) {
      const token = decryptToken(installation.accessToken);
      await shopifyRequest(body.shop, token, 'DELETE', `/script_tags/${installation.scriptTagId}.json`).catch(() => {});
    }

    // Soft-delete: mark as uninstalled
    await db.update(shopifyInstallations)
      .set({ uninstalledAt: new Date(), updatedAt: new Date() })
      .where(eq(shopifyInstallations.id, installation.id));

    return reply.code(200).send({ data: { disconnected: true } });
  });
};

// ── Webhook Routes (no Clerk auth — separate plugin) ─────────────────────────

export const shopifyWebhookRoutes: FastifyPluginAsync = async (fastify) => {

  // Parse raw body for HMAC validation
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    try {
      const parsed = JSON.parse((body as Buffer).toString('utf8'));
      // Attach raw body for HMAC
      (req as any).rawBody = body;
      done(null, parsed);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  function verifyShopifyWebhook(request: any, reply: any): boolean {
    let secret: string;
    try {
      secret = getConfig().apiSecret;
    } catch {
      reply.code(500).send({ error: 'Shopify not configured' });
      return false;
    }

    const sentHmac = request.headers['x-shopify-hmac-sha256'] as string;
    const rawBody: Buffer = request.rawBody;

    if (!sentHmac || !rawBody) {
      reply.code(401).send({ error: 'Missing HMAC header or body' });
      return false;
    }

    if (!validateWebhookHmac(rawBody, secret, sentHmac)) {
      reply.code(401).send({ error: 'Invalid HMAC' });
      return false;
    }
    return true;
  }

  // ── POST /webhooks/shopify/app/uninstalled ───────────────────────────────
  fastify.post('/shopify/app/uninstalled', async (request, reply) => {
    if (!verifyShopifyWebhook(request, reply)) return;

    const body = request.body as { domain?: string; myshopify_domain?: string };
    const shop = body.myshopify_domain ?? body.domain ?? '';

    if (shop) {
      await db.update(shopifyInstallations)
        .set({ uninstalledAt: new Date(), updatedAt: new Date() })
        .where(eq(shopifyInstallations.shop, shop));

      // Also mark the associated site as unverified
      await db.update(sites)
        .set({ verifiedAt: null, updatedAt: new Date() })
        .where(eq(sites.shopifyShop, shop));
    }

    return reply.code(200).send({ received: true });
  });

  // ── POST /webhooks/shopify/shop/redact (GDPR mandatory) ─────────────────
  fastify.post('/shopify/shop/redact', async (request, reply) => {
    if (!verifyShopifyWebhook(request, reply)) return;

    const body = request.body as { myshopify_domain?: string; shop_domain?: string };
    const shop = body.myshopify_domain ?? body.shop_domain ?? '';

    request.log.info({ shop }, '[GDPR] shop/redact received');

    if (shop) {
      // Soft-delete installation record (access token scrubbed below)
      await db.update(shopifyInstallations)
        .set({
          accessToken: '[REDACTED]',
          uninstalledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(shopifyInstallations.shop, shop));
    }

    return reply.code(200).send({ received: true });
  });

  // ── POST /webhooks/shopify/customers/redact (GDPR mandatory) ────────────
  fastify.post('/shopify/customers/redact', async (request, reply) => {
    if (!verifyShopifyWebhook(request, reply)) return;

    const body = request.body as { shop_domain?: string; customer?: { id?: number } };
    request.log.info({ shop: body.shop_domain, customerId: body.customer?.id }, '[GDPR] customers/redact received');

    // ScrollPop does not store PII per-customer; log receipt and confirm compliance.
    return reply.code(200).send({ received: true });
  });

  // ── POST /webhooks/shopify/customers/data_request (GDPR mandatory) ──────
  fastify.post('/shopify/customers/data_request', async (request, reply) => {
    if (!verifyShopifyWebhook(request, reply)) return;

    const body = request.body as { shop_domain?: string; customer?: { id?: number; email?: string } };
    request.log.info({ shop: body.shop_domain, customerId: body.customer?.id }, '[GDPR] customers/data_request received');

    // ScrollPop stores anonymous visitor IDs only — no personal customer data.
    return reply.code(200).send({ received: true });
  });

  // ── POST /webhooks/shopify/orders/paid — Revenue attribution ─────────────
  // Receives Shopify order.paid events and attributes revenue to the last
  // popup interaction for that store (last-touch model, 24h attribution window).
  // To receive this webhook: register topic "orders/paid" during OAuth install.
  fastify.post('/shopify/orders/paid', async (request, reply) => {
    if (!verifyShopifyWebhook(request, reply)) return;

    const body = request.body as {
      id?: number;
      order_number?: number;
      total_price?: string;
      currency?: string;
      myshopify_domain?: string;
    };

    const shop = body.myshopify_domain ?? '';
    const shopifyOrderId = String(body.id ?? '');
    const totalPrice = parseFloat(body.total_price ?? '0');
    const revenueCents = Math.round(totalPrice * 100);

    if (!shop || !shopifyOrderId || revenueCents <= 0) {
      return reply.code(200).send({ received: true });
    }

    try {
      // Look up the site for this Shopify store
      const installation = await db.query.shopifyInstallations.findFirst({
        where: and(
          eq(shopifyInstallations.shop, shop),
          isNull(shopifyInstallations.uninstalledAt)
        ),
        columns: { siteId: true, tenantId: true },
      });

      if (!installation?.siteId || !installation.tenantId) {
        request.log.info({ shop }, 'orders/paid: no active installation found');
        return reply.code(200).send({ received: true });
      }

      // Find the most recent popup interaction for this site in the last 24 hours.
      // This is a last-touch attribution model: the last campaign the visitor
      // interacted with gets credit for the purchase.
      const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const lastInteraction = await db.query.events.findFirst({
        where: and(
          eq(events.tenantId, installation.tenantId),
          eq(events.siteId, installation.siteId),
          gte(events.ts, windowStart)
        ),
        orderBy: [desc(events.ts)],
        columns: { campaignId: true, visitorId: true, sessionId: true, trafficSource: true },
      });

      if (!lastInteraction) {
        request.log.info({ shop }, 'orders/paid: no recent popup interaction found for attribution');
        return reply.code(200).send({ received: true });
      }

      // Write a purchase_completed event attributed to that campaign
      await db.insert(events).values({
        tenantId: installation.tenantId,
        siteId: installation.siteId,
        campaignId: lastInteraction.campaignId,
        eventType: 'purchase_completed',
        visitorId: lastInteraction.visitorId,
        sessionId: lastInteraction.sessionId,
        shopifyOrderId,
        revenueCents,
        trafficSource: lastInteraction.trafficSource,
        device: 'unknown',
        pageUrl: `https://${shop}/`,
        referrer: '',
        ts: new Date(),
      });

      request.log.info({ shop, shopifyOrderId, revenueCents, campaignId: lastInteraction.campaignId },
        'orders/paid: revenue attributed to campaign');
    } catch (err) {
      request.log.error({ err }, 'orders/paid: attribution failed');
    }

    return reply.code(200).send({ received: true });
  });
};
