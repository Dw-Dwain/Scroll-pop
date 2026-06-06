/**
 * Tenant ESP integrations CRUD — P1-8 (Klaviyo) + P1-9 (Mailchimp).
 *
 * GET  /api/v1/integrations      → returns config with API keys masked (last 4 chars)
 * PUT  /api/v1/integrations      → upserts config; omitting apiKey preserves the existing one
 * POST /api/v1/integrations/test → fire a test event to verify credentials
 */
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { tenants } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { syncToKlaviyo, syncToMailchimp } from '../lib/esp.js';

const EspProviderBody = z.object({
  enabled: z.boolean(),
  apiKey: z.string().max(500).optional(),
  listId: z.string().max(200).optional(),
});

const IntegrationsBody = z.object({
  klaviyo:   EspProviderBody.optional(),
  mailchimp: EspProviderBody.optional(),
});

type ProviderConfig = { enabled: boolean; apiKey?: string | undefined; listId?: string | undefined };
type IntegrationsCfg = { klaviyo?: ProviderConfig; mailchimp?: ProviderConfig };

/** Replace API key with "••••<last4>" for safe GET responses. */
function maskKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return key.length > 4 ? `${'•'.repeat(Math.min(key.length - 4, 12))}${key.slice(-4)}` : '••••';
}

function maskConfig(cfg: IntegrationsCfg): Record<string, unknown> {
  return {
    klaviyo: cfg.klaviyo ? { ...cfg.klaviyo, apiKey: maskKey(cfg.klaviyo.apiKey) } : undefined,
    mailchimp: cfg.mailchimp ? { ...cfg.mailchimp, apiKey: maskKey(cfg.mailchimp.apiKey) } : undefined,
  };
}

export const integrationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/integrations — returns current config with masked API keys
  fastify.get('/integrations', async (request, reply) => {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, request.tenantId),
      columns: { integrations: true },
    });
    const cfg = (tenant?.integrations ?? {}) as IntegrationsCfg;
    return reply.send({ data: maskConfig(cfg) });
  });

  // PUT /api/v1/integrations — upserts credentials; omit apiKey to preserve existing
  fastify.put('/integrations', async (request, reply) => {
    const body = IntegrationsBody.parse(request.body);

    // Load existing config so we can preserve keys not sent in this request
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, request.tenantId),
      columns: { integrations: true },
    });
    // SR-13: if the tenant vanished (soft-deleted mid-request or bad JWT) the UPDATE
    // below would affect 0 rows and still return 200 with an empty config. Fail loudly.
    if (!tenant) {
      return reply.code(404).send({ error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' } });
    }
    const existing = (tenant.integrations ?? {}) as IntegrationsCfg;

    const merged: IntegrationsCfg = { ...existing };

    if (body.klaviyo !== undefined) {
      merged.klaviyo = {
        enabled: body.klaviyo.enabled,
        listId: body.klaviyo.listId ?? existing.klaviyo?.listId,
        // Preserve existing key if no new key provided
        apiKey: body.klaviyo.apiKey ?? existing.klaviyo?.apiKey,
      };
    }

    if (body.mailchimp !== undefined) {
      merged.mailchimp = {
        enabled: body.mailchimp.enabled,
        listId: body.mailchimp.listId ?? existing.mailchimp?.listId,
        apiKey: body.mailchimp.apiKey ?? existing.mailchimp?.apiKey,
      };
    }

    await db
      .update(tenants)
      .set({ integrations: merged, updatedAt: new Date() })
      .where(eq(tenants.id, request.tenantId));

    return reply.send({ data: maskConfig(merged) });
  });

  // POST /api/v1/integrations/test — sends a real test contact to verify credentials.
  // SR-09: keyed per-tenant (not IP) so a multi-IP actor can't fan out unsolicited
  // subscribe calls to arbitrary testEmail addresses across many source IPs.
  fastify.post<{ Body: { provider: 'klaviyo' | 'mailchimp'; testEmail: string } }>(
    '/integrations/test',
    {
      config: {
        rateLimit: { max: 5, timeWindow: '1 minute', keyGenerator: (req) => req.tenantId },
      },
    },
    async (request, reply) => {
      const { provider, testEmail } = z.object({
        provider: z.enum(['klaviyo', 'mailchimp']),
        testEmail: z.string().email(),
      }).parse(request.body);

      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, request.tenantId),
        columns: { integrations: true },
      });
      const cfg = (tenant?.integrations ?? {}) as IntegrationsCfg;

      // SR-02: run the adapter in test mode and inspect the result. The adapters are
      // best-effort (never throw) on the ingest path, so a try/catch here would never
      // catch a wrong-key failure — testMode returns it as { ok:false } instead.
      let result;
      if (provider === 'klaviyo') {
        const kl = cfg.klaviyo;
        if (!kl?.apiKey || !kl?.listId) {
          return reply.code(400).send({ error: { code: 'NOT_CONFIGURED', message: 'Klaviyo API key and list ID required' } });
        }
        result = await syncToKlaviyo({ apiKey: kl.apiKey, listId: kl.listId, contact: { email: testEmail }, testMode: true });
      } else {
        const mc = cfg.mailchimp;
        if (!mc?.apiKey || !mc?.listId) {
          return reply.code(400).send({ error: { code: 'NOT_CONFIGURED', message: 'Mailchimp API key and list ID required' } });
        }
        result = await syncToMailchimp({ apiKey: mc.apiKey, listId: mc.listId, contact: { email: testEmail }, testMode: true });
      }

      if (!result.ok) {
        return reply.code(502).send({ error: { code: 'ESP_ERROR', message: result.error ?? `Failed to reach ${provider}` } });
      }
      return reply.send({ data: { ok: true, message: `Test contact sent to ${provider}` } });
    },
  );
};
