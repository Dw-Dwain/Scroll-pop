import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { campaigns } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import crypto from 'node:crypto';
import { isPublicUrl } from '../lib/url-guard.js';
import { encryptToken, decryptToken } from '../lib/token-crypto.js';

// Allowed event types operators can subscribe to via outbound webhook.
const WEBHOOK_EVENTS = ['email_capture', 'conversion', 'click', 'dismiss'] as const;
type WebhookEvent = typeof WEBHOOK_EVENTS[number];

const OutboundWebhookBody = z.object({
  enabled: z.boolean(),
  url: z.string().url().refine(
    (u) => u.startsWith('https://') || u.startsWith('http://'),
    { message: 'Webhook URL must use http or https' },
  ).optional(),
  // HMAC-SHA256 secret — used to sign the payload so the receiver can verify authenticity.
  // Operators should treat this like a password. We never return it in GET responses.
  secret: z.string().max(256).optional(),
  // Optional (no default): on a PUT, an omitted `events` must preserve the previously-saved
  // selection, not silently reset it. fireOutboundWebhook defaults to ['email_capture',
  // 'conversion'] at fire time when none is stored.
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).max(WEBHOOK_EVENTS.length).optional(),
});

export type OutboundWebhookConfig = z.infer<typeof OutboundWebhookBody>;

/**
 * Fire an outbound webhook for a campaign event. Best-effort — never throws.
 * Payload is signed with HMAC-SHA256 if the operator configured a secret.
 */
export async function fireOutboundWebhook(opts: {
  config: Record<string, unknown>;
  event: WebhookEvent;
  campaignId: string;
  tenantId: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const { config, event, campaignId, tenantId, data } = opts;
  if (config['enabled'] !== true) return;

  const events = Array.isArray(config['events']) ? config['events'] : ['email_capture', 'conversion'];
  if (!events.includes(event)) return;

  const url = typeof config['url'] === 'string' ? config['url'] : null;
  if (!url) return;

  const payload = JSON.stringify({
    event,
    campaignId,
    tenantId,
    timestamp: new Date().toISOString(),
    data,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'ScrollPop-Webhook/1.0',
  };

  // HMAC-SHA256 signature so receivers can verify the payload wasn't tampered with.
  // The secret is stored encrypted at rest (M-2) — decrypt before signing. decryptToken
  // passes through legacy plaintext values unchanged, so pre-encryption configs still work.
  const storedSecret = typeof config['secret'] === 'string' ? config['secret'] : null;
  const secret = storedSecret ? decryptToken(storedSecret) : null;
  if (secret) {
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    headers['x-scrollpop-signature'] = `sha256=${sig}`;
  }

  // SSRF guard at fire time — re-resolve the host every fire so a DNS-rebind from a
  // public to a private IP after save can't reach internal services.
  if (!(await isPublicUrl(url))) return; // silently skip — operator misconfiguration

  try {
    await fetch(url, {
      method: 'POST',
      headers,
      body: payload,
      signal: AbortSignal.timeout(5000), // 5s hard timeout — never block ingest
      redirect: 'error', // prevents open-redirect bypass of the SSRF blocklist
    });
  } catch { /* best-effort — log nothing to avoid polluting ingest logs */ }
}

export const outboundWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/campaigns/:id/webhook
  // Returns config WITHOUT the secret (write-only field).
  fastify.get<{ Params: { id: string } }>('/campaigns/:id/webhook', async (request, reply) => {
    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, request.params.id),
        eq(campaigns.tenantId, request.tenantId),
        isNull(campaigns.deletedAt),
      ),
      columns: { id: true, outboundWebhook: true },
    });
    if (!campaign) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    const cfg = (campaign.outboundWebhook ?? {}) as Record<string, unknown>;
    // Strip the secret from the response — write-only.
    const { secret: _secret, ...safeConfig } = cfg;
    return reply.send({ data: safeConfig });
  });

  // PUT /api/v1/campaigns/:id/webhook
  fastify.put<{ Params: { id: string } }>('/campaigns/:id/webhook', async (request, reply) => {
    const body = OutboundWebhookBody.parse(request.body);

    // If no new secret provided, preserve the existing one (so operators can update
    // enabled/events without accidentally clearing their secret).
    const existing = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, request.params.id),
        eq(campaigns.tenantId, request.tenantId),
        isNull(campaigns.deletedAt),
      ),
      columns: { outboundWebhook: true },
    });
    if (!existing) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    const prev = (existing.outboundWebhook ?? {}) as Record<string, unknown>;
    // Merge onto the previous config so a partial update (e.g. just toggling `enabled`)
    // preserves fields the operator didn't send. `...body` only carries keys that were
    // actually supplied (url/events/secret are optional in the schema), so omitted fields
    // fall back to prev rather than being overwritten with undefined/defaults.
    const merged = {
      ...prev,
      ...body,
      // Keep previous secret unless a new one is explicitly supplied. A newly-supplied secret
      // is encrypted at rest (M-2); the previous value is already stored encrypted.
      secret: body.secret ? encryptToken(body.secret) : prev['secret'],
    };

    const [updated] = await db
      .update(campaigns)
      .set({ outboundWebhook: merged, updatedAt: new Date() })
      .where(and(
        eq(campaigns.id, request.params.id),
        eq(campaigns.tenantId, request.tenantId),
        isNull(campaigns.deletedAt),
      ))
      .returning({ id: campaigns.id, outboundWebhook: campaigns.outboundWebhook });

    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const { secret: _secret, ...safeConfig } = (updated.outboundWebhook ?? {}) as Record<string, unknown>;
    return reply.send({ data: safeConfig });
  });
};
