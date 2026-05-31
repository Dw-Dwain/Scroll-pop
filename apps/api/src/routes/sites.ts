import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { sites, campaigns, events } from '../db/schema.js';
import { eq, and, isNull, sql, gte } from 'drizzle-orm';

const CreateSiteBody = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().url().or(z.string().regex(/^[a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/)),
  platform: z.enum(['wordpress', 'shopify', 'html', 'donorbox', 'gofundme', 'other']).default('html'),
});

const UpdateSiteBody = z.object({
  name: z.string().min(1).max(100).optional(),
  platform: z.enum(['wordpress', 'shopify', 'html', 'donorbox', 'gofundme', 'other']).optional(),
  wpSiteUrl: z.string().url().optional(),
});

export const siteRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/sites
  fastify.get('/sites', async (request, reply) => {
    const tenantSites = await db.query.sites.findMany({
      where: and(eq(sites.tenantId, request.tenantId), isNull(sites.deletedAt)),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });

    // Enrich each site with real campaign count and monthly impression count.
    // Wrapped in try/catch per-site so a query error never kills the whole list.
    const enriched = await Promise.all(tenantSites.map(async (site) => {
      try {
        const [campaignRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(campaigns)
          .where(and(eq(campaigns.siteId, site.id), isNull(campaigns.deletedAt)));

        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const [viewRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(events)
          .where(and(
            eq(events.siteId, site.id),
            eq(events.eventType, 'impression'),
            gte(events.ts, monthStart)
          ));

        return {
          ...site,
          campaignCount: campaignRow?.count ?? 0,
          totalViews:    viewRow?.count    ?? 0,
        };
      } catch {
        // Enrichment failed (e.g. missing partition) — return site with zeroes
        return { ...site, campaignCount: 0, totalViews: 0 };
      }
    }));

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

    let wpResponse: { public_key?: string; enabled?: boolean; plugin?: string; version?: string } = {};
    try {
      const res = await fetch(statusUrl, {
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

    // Verify the plugin returned our public key
    if (wpResponse.public_key !== site.publicKey) {
      return reply.code(422).send({
        error: {
          code: 'KEY_MISMATCH',
          message: `Public key mismatch. The plugin has "${wpResponse.public_key ?? '(empty)'}" but this site's key is "${site.publicKey}". Update the key in WordPress Settings → ScrollPop.`,
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
