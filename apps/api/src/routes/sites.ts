import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { sites, campaigns, events, tenants } from '../db/schema.js';
import { eq, and, isNull, sql, gte } from 'drizzle-orm';
import { isPublicUrl, safePublicFetch } from '../lib/url-guard.js';
import { PLAN_LIMITS, AffiliateLinkSchema } from '@scrollpop/shared';

const CreateSiteBody = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().url().or(z.string().regex(/^[a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/)),
  platform: z.enum(['wordpress', 'shopify', 'html', 'donorbox', 'gofundme', 'other']).default('html'),
});

const UpdateSiteBody = z.object({
  name: z.string().min(1).max(100).optional(),
  platform: z.enum(['wordpress', 'shopify', 'html', 'donorbox', 'gofundme', 'other']).optional(),
  wpSiteUrl: z.string().url().optional(),
  // Storefront/custom domain the snippet is served on (bare host or URL). Empty string clears it.
  customDomain: z.string().max(253).optional(),
  // Assign the site to an agency client workspace (null = agency-level / unassign).
  clientId: z.string().uuid().nullable().optional(),
  // Per-site saved affiliate links (replaces the whole list when present). Each URL is validated
  // http(s) by AffiliateLinkSchema; the snippet additionally renders them through safeHref.
  affiliateLinks: z.array(AffiliateLinkSchema).max(100).optional(),
});

export const siteRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/sites
  fastify.get<{ Querystring: { clientId?: string } }>('/sites', async (request, reply) => {
    const { clientId } = request.query;
    const tenantSites = await db.query.sites.findMany({
      where: and(
        eq(sites.tenantId, request.tenantId),
        isNull(sites.deletedAt),
        clientId ? eq(sites.clientId, clientId) : undefined,
      ),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });

    // Enrich each site with real campaign count and monthly impression count.
    // SEQUENTIAL (not Promise.all): under RLS each request holds a single reserved tenant
    // connection that can't run concurrent queries → 500. Per-site try/catch keeps one bad query
    // from killing the whole list (the site just returns zeroes).
    const enriched: Array<typeof tenantSites[number] & { campaignCount: number; totalViews: number }> = [];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    for (const site of tenantSites) {
      try {
        const [campaignRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(campaigns)
          .where(and(eq(campaigns.siteId, site.id), isNull(campaigns.deletedAt)));

        const [viewRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(events)
          .where(and(
            eq(events.siteId, site.id),
            eq(events.eventType, 'impression'),
            gte(events.ts, monthStart)
          ));

        enriched.push({ ...site, campaignCount: campaignRow?.count ?? 0, totalViews: viewRow?.count ?? 0 });
      } catch {
        enriched.push({ ...site, campaignCount: 0, totalViews: 0 });
      }
    }

    return reply.send({ data: enriched });
  });

  // POST /api/v1/sites
  fastify.post('/sites', async (request, reply) => {
    const body = CreateSiteBody.parse(request.body);

    // Normalize domain: strip protocol, trailing slash
    const domain = body.domain
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .toLowerCase();

    // Check if domain is already registered for this tenant
    const existing = await db.query.sites.findFirst({
      where: and(eq(sites.tenantId, request.tenantId), eq(sites.domain, domain)),
    });

    if (existing) {
      if (existing.deletedAt) {
        // Domain was previously soft-deleted — reactivate it!
        const [reactivated] = await db
          .update(sites)
          .set({
            name: body.name,
            platform: body.platform,
            deletedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(sites.id, existing.id))
          .returning();
        return reply.code(201).send({ data: reactivated });
      } else {
        // Domain is active
        return reply.code(409).send({
          error: { code: 'DUPLICATE_DOMAIN', message: 'This domain is already registered.' },
        });
      }
    }

    // Plan site-count limit (free 1 / agency 999). Enforced server-side, not just in the UI.
    // Unlimited users (admin/Novatise) bypass. Any legacy starter/growth/scale tenant that
    // still exists falls back to free limits (those tiers are no longer offered).
    if (!request.isUnlimited) {
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, request.tenantId),
        columns: { plan: true },
      });
      const planKey = tenant?.plan === 'agency' ? 'agency' : 'free';
      const maxSites = PLAN_LIMITS[planKey].sites;
      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(sites)
        .where(and(eq(sites.tenantId, request.tenantId), isNull(sites.deletedAt)));
      if ((countRow?.count ?? 0) >= maxSites) {
        return reply.code(403).send({
          error: { code: 'SITE_LIMIT', message: `Your plan includes ${maxSites} site${maxSites === 1 ? '' : 's'}. Upgrade to add more.` },
        });
      }
    }

    const [site] = await db
      .insert(sites)
      .values({
        tenantId: request.tenantId,
        name: body.name,
        domain,
        platform: body.platform,
      })
      .returning();

    return reply.code(201).send({ data: site });
  });

  // GET /api/v1/sites/:id
  fastify.get<{ Params: { id: string } }>('/sites/:id', async (request, reply) => {
    const site = await db.query.sites.findFirst({
      where: and(
        eq(sites.id, request.params.id),
        eq(sites.tenantId, request.tenantId),
        isNull(sites.deletedAt)
      ),
    });

    if (!site) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Site not found' } });
    return reply.send({ data: site });
  });

  // PATCH /api/v1/sites/:id
  fastify.patch<{ Params: { id: string } }>('/sites/:id', async (request, reply) => {
    const body = UpdateSiteBody.parse(request.body);

    const [updated] = await db
      .update(sites)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.platform !== undefined ? { platform: body.platform } : {}),
        ...(body.wpSiteUrl !== undefined ? { wpSiteUrl: body.wpSiteUrl } : {}),
        ...(body.customDomain !== undefined
          ? { customDomain: body.customDomain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '') || null }
          : {}),
        ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
        ...(body.affiliateLinks !== undefined ? { affiliateLinks: body.affiliateLinks } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(sites.id, request.params.id), eq(sites.tenantId, request.tenantId)))
      .returning();

    if (!updated) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Site not found' } });
    return reply.send({ data: updated });
  });

  // DELETE /api/v1/sites/:id (soft delete)
  fastify.delete<{ Params: { id: string } }>('/sites/:id', async (request, reply) => {
    const [deleted] = await db
      .update(sites)
      .set({ deletedAt: new Date() })
      .where(and(eq(sites.id, request.params.id), eq(sites.tenantId, request.tenantId)))
      .returning();

    if (!deleted) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Site not found' } });
    }
    return reply.code(200).send({ data: deleted });
  });

  // GET /api/v1/sites/:id/snippet — returns the install snippet HTML
  fastify.get<{ Params: { id: string } }>('/sites/:id/snippet', async (request, reply) => {
    const site = await db.query.sites.findFirst({
      where: and(
        eq(sites.id, request.params.id),
        eq(sites.tenantId, request.tenantId),
        isNull(sites.deletedAt)
      ),
    });

    if (!site) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Site not found' } });

    const cdnUrl = process.env['SNIPPET_CDN_URL'] ?? 'https://cdn.scrollpop.online';

    const snippetHtml = `<!-- ScrollPop -->
<script>
(function(w,d,s){
  var p=w.__sp=w.__sp||{q:[],identify:function(v){p.q.push(['identify',v])},loaded:false};
  if(p.loaded)return; p.loaded=true;
  var el=d.createElement(s); el.async=true; el.defer=true;
  el.src='${cdnUrl}/v1/${site.publicKey}/p.js';
  d.head.appendChild(el);
})(window,document,'script');
</script>
<!-- End ScrollPop -->`;

    return reply.send({
      data: {
        publicKey: site.publicKey,
        platform: site.platform,
        snippetHtml,
        installInstructions: getInstallInstructions(site.platform, site.publicKey, cdnUrl),
      },
    });
  });

  // POST /api/v1/sites/:id/verify
  fastify.post<{ Params: { id: string } }>('/sites/:id/verify', async (request, reply) => {
    const site = await db.query.sites.findFirst({
      where: and(
        eq(sites.id, request.params.id),
        eq(sites.tenantId, request.tenantId),
        isNull(sites.deletedAt)
      ),
    });

    if (!site) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Site not found' } });

    const [updated] = await db
      .update(sites)
      .set({ verifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(sites.id, site.id))
      .returning();

    if (!updated) {
      return reply.code(500).send({ error: { code: 'UPDATE_FAILED', message: 'Failed to verify site' } });
    }

    return reply.send({
      data: {
        verified: true,
        verifiedAt: updated.verifiedAt,
        message: 'Site successfully verified in Local Development!'
      }
    });
  });

  // POST /api/v1/sites/:id/verify-wordpress
  // Calls the WordPress site's /wp-json/scrollpop/v1/status endpoint to confirm
  // the plugin is installed and the public key matches.
  fastify.post<{ Params: { id: string } }>('/sites/:id/verify-wordpress', async (request, reply) => {
    const site = await db.query.sites.findFirst({
      where: and(
        eq(sites.id, request.params.id),
        eq(sites.tenantId, request.tenantId),
        isNull(sites.deletedAt)
      ),
    });

    if (!site) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Site not found' } });

    // ── Dev / staging bypass ──────────────────────────────────────────────────
    // In non-production environments (NODE_ENV !== 'production') skip the live
    // WordPress REST endpoint check and auto-verify.  This lets staging/dev
    // testing proceed without needing the WP plugin installed and configured
    // with the staging site's public key.
    if (process.env['NODE_ENV'] !== 'production') {
      const [devUpdated] = await db
        .update(sites)
        .set({ verifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(sites.id, site.id))
        .returning();
      return reply.send({
        data: {
          verified: true,
          verifiedAt: devUpdated?.verifiedAt,
          message: '✅ Verification bypassed in dev/staging mode.',
        },
      });
    }
    // ── End dev bypass ────────────────────────────────────────────────────────

    // Determine base URL for the WordPress site
    const wpBase = site.wpSiteUrl ?? `https://${site.domain}`;
    const statusUrl = `${wpBase.replace(/\/$/, '')}/wp-json/scrollpop/v1/status`;

    // SSRF guard (H-3): the WP URL is operator-supplied; refuse to fetch anything that
    // resolves to a private/loopback/link-local/metadata address.
    if (!(await isPublicUrl(statusUrl))) {
      return reply.code(422).send({
        error: { code: 'WP_UNREACHABLE', message: 'WordPress site URL must be a public address.', statusUrl },
      });
    }

    let wpResponse: { public_key?: string; enabled?: boolean; plugin?: string; version?: string } = {};
    try {
      // safePublicFetch follows redirects (apex→www, http→https) re-checking the SSRF guard on
      // every hop, so a WP site that redirects still verifies while a redirect can never reach an
      // internal host.
      const res = await safePublicFetch(statusUrl, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        return reply.code(422).send({
          error: {
            code: 'WP_UNREACHABLE',
            message: `WordPress status endpoint returned HTTP ${res.status}. Make sure the ScrollPop plugin is installed and active.`,
            statusUrl,
          },
        });
      }
      wpResponse = await res.json() as typeof wpResponse;
    } catch (err: any) {
      return reply.code(422).send({
        error: {
          code: 'WP_UNREACHABLE',
          message: `Could not reach ${statusUrl}. Is the site accessible and the plugin installed?`,
          detail: err?.message,
          statusUrl,
        },
      });
    }

    // Verify the plugin returned our public key. Do NOT echo back the fetched response's
    // public_key (H-3): reflecting an arbitrary fetched value would turn this into a blind-SSRF
    // read primitive. Compare server-side only.
    if (wpResponse.public_key !== site.publicKey) {
      return reply.code(422).send({
        error: {
          code: 'KEY_MISMATCH',
          message: `Public key mismatch. The ScrollPop plugin on your WordPress site isn't configured with this site's key. Set it to "${site.publicKey}" in WordPress Settings → ScrollPop.`,
        },
      });
    }

    if (!wpResponse.enabled) {
      return reply.code(422).send({
        error: {
          code: 'PLUGIN_DISABLED',
          message: 'ScrollPop plugin is installed but disabled. Enable it in WordPress Settings → ScrollPop.',
        },
      });
    }

    // All good — mark site as verified
    const [updated] = await db
      .update(sites)
      .set({ verifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(sites.id, site.id))
      .returning();

    return reply.send({
      data: {
        verified: true,
        verifiedAt: updated?.verifiedAt,
        wpVersion: wpResponse.version,
        message: 'WordPress plugin verified successfully!',
      },
    });
  });

  // POST /api/v1/sites/:id/verify-snippet
  // Generic snippet-presence check for MANUAL installs (Shopify theme header, raw HTML, etc.)
  // where there's no OAuth app. Fetches the site's homepage and confirms the served HTML
  // references this site's public key (the embed loads cdn.scrollpop.online/v1/<key>/p.js).
  // Mirrors verify-wordpress; auto-passes in dev/staging.
  fastify.post<{ Params: { id: string } }>('/sites/:id/verify-snippet', async (request, reply) => {
    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, request.params.id), eq(sites.tenantId, request.tenantId), isNull(sites.deletedAt)),
    });
    if (!site) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Site not found' } });

    if (process.env['NODE_ENV'] !== 'production') {
      const [devUpdated] = await db.update(sites)
        .set({ verifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(sites.id, site.id)).returning();
      return reply.send({ data: { verified: true, verifiedAt: devUpdated?.verifiedAt, message: '✅ Verification bypassed in dev/staging mode.' } });
    }

    const shopHost = site.shopifyShop
      ? (site.shopifyShop.includes('.') ? site.shopifyShop : `${site.shopifyShop}.myshopify.com`)
      : null;

    // Storefront URLs to check, most-likely-first: the custom/storefront domain, the stored
    // domain, then the Shopify shop host. `safePublicFetch` follows redirects with a per-hop SSRF
    // re-check, so a Shopify store on a custom primary domain (whose *.myshopify.com 301s to the
    // storefront) and apex→www / http→https redirects verify correctly instead of failing on the
    // redirect. The SSRF guard (H-3) is preserved — each hop must resolve to a public address.
    const toHost = (d: string) => d.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const candidates = [...new Set(
      [site.customDomain, site.domain, shopHost]
        .filter((d): d is string => !!d)
        .map((d) => `https://${toHost(d)}`),
    )];

    if (candidates.length === 0) {
      return reply.code(422).send({ error: { code: 'UNREACHABLE', message: 'No domain on record for this site.' } });
    }

    let lastError = '';
    for (const base of candidates) {
      try {
        const res = await safePublicFetch(base, {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'ScrollPop-Verify/1.0' },
        });
        if (!res.ok) { lastError = `${base} returned HTTP ${res.status}.`; continue; }
        const html = await res.text();
        if (site.publicKey && html.includes(site.publicKey)) {
          const [updated] = await db.update(sites)
            .set({ verifiedAt: new Date(), updatedAt: new Date() })
            .where(eq(sites.id, site.id)).returning();
          return reply.send({ data: { verified: true, verifiedAt: updated?.verifiedAt, message: 'Snippet detected — site verified!' } });
        }
        lastError = `Snippet (this site's public key) not found at ${base}.`;
      } catch (err: any) {
        lastError = `Could not reach ${base}. ${err?.message ?? ''}`.trim();
      }
    }

    return reply.code(422).send({
      error: {
        code: /not found/i.test(lastError) ? 'SNIPPET_NOT_FOUND' : 'UNREACHABLE',
        message: `${lastError} Confirm the embed (with this site's public key) is live on your storefront, then retry. Note: snippets injected via a tag manager may not be detectable here.`,
      },
    });
  });

  // PATCH /api/v1/sites/:id/wordpress-url — store the WP site URL override
  fastify.patch<{ Params: { id: string } }>('/sites/:id/wordpress-url', async (request, reply) => {
    const body = z.object({ wpSiteUrl: z.string().url() }).parse(request.body);

    const [updated] = await db
      .update(sites)
      .set({ wpSiteUrl: body.wpSiteUrl, updatedAt: new Date() })
      .where(and(eq(sites.id, request.params.id), eq(sites.tenantId, request.tenantId)))
      .returning();

    if (!updated) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Site not found' } });
    return reply.send({ data: updated });
  });
};

function getInstallInstructions(
  platform: string,
  publicKey: string,
  cdnUrl: string
): Record<string, string> {
  const stub = `<script>
(function(w,d,s){
  var p=w.__sp=w.__sp||{q:[],identify:function(v){p.q.push(['identify',v])},loaded:false};
  if(p.loaded)return; p.loaded=true;
  var el=d.createElement(s); el.async=true; el.defer=true;
  el.src='${cdnUrl}/v1/${publicKey}/p.js';
  d.head.appendChild(el);
})(window,document,'script');
</script>`;

  return {
    html: `Paste this snippet inside <head> on every page:\n\n${stub}`,
    wordpress: `Install the ScrollPop WordPress plugin, then go to Settings → ScrollPop and enter your Site Public Key: ${publicKey}`,
    shopify: `In your Shopify admin: Online Store → Themes → Customize → App Embeds → Enable ScrollPop. Your Site Key: ${publicKey}`,
    gtm: `In Google Tag Manager, create a new Custom HTML tag with the snippet above. Set trigger to "All Pages".`,
  };
}
