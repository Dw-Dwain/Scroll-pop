import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client.js';
import { tenants } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { isGreyHatTenant, killSwitchValueIsEnabled } from '../lib/grey-hat.js';
import { recordAudit } from '../lib/audit.js';

/**
 * Grey-hat kill-switch admin API (Novatise-only).
 *
 * Lets a Novatise owner flip the global X-close-redirect kill switch from the dashboard instead of
 * SSH-ing wrangler. The switch is a Cloudflare KV key the Worker reads per request (see
 * apps/worker/src/index.ts) — when set, every served config has its X-close affiliate redirect
 * stripped instantly, no deploy. We read/write that key via the Cloudflare API, the same mechanism
 * lib/cache-purge.ts uses for config purges (same KV namespace = CLOUDFLARE_KV_NAMESPACE_ID).
 */

// MUST match GREY_HAT_KILL_SWITCH_KEY in apps/worker/src/index.ts — the key the Worker reads.
const KILL_SWITCH_KEY = 'killswitch:adclose';

function cfKvConfigured(): boolean {
  return !!(
    process.env['CLOUDFLARE_ACCOUNT_ID'] &&
    process.env['CLOUDFLARE_API_TOKEN'] &&
    process.env['CLOUDFLARE_KV_NAMESPACE_ID']
  );
}

function cfKvUrl(key: string): string {
  const accountId = process.env['CLOUDFLARE_ACCOUNT_ID'];
  const ns = process.env['CLOUDFLARE_KV_NAMESPACE_ID'];
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${ns}/values/${encodeURIComponent(key)}`;
}

/**
 * Gate every route to the Novatise org tenant. Self-row tenant lookup (`id = request.tenantId`) is
 * RLS-safe under the tenants_self_isolation policy. Sends 403 + returns false for anyone else.
 */
async function assertNovatise(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, request.tenantId),
    columns: { clerkOrgId: true },
  });
  if (!isGreyHatTenant(tenant?.clerkOrgId)) {
    void reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Not available for this account.' } });
    return false;
  }
  return true;
}

export const greyHatRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/grey-hat/killswitch
   * → { data: { enabled: boolean, configured: boolean } }
   * `configured:false` means edge KV isn't wired on this environment (e.g. local dev).
   */
  fastify.get('/grey-hat/killswitch', async (request, reply) => {
    if (!(await assertNovatise(request, reply))) return;
    if (!cfKvConfigured()) return reply.send({ data: { enabled: false, configured: false } });

    const token = process.env['CLOUDFLARE_API_TOKEN'];
    try {
      const res = await fetch(cfKvUrl(KILL_SWITCH_KEY), { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 404) return reply.send({ data: { enabled: false, configured: true } }); // key absent = off
      if (!res.ok) {
        return reply.code(502).send({ error: { code: 'KV_READ_FAILED', message: 'Could not read kill-switch state.' } });
      }
      return reply.send({ data: { enabled: killSwitchValueIsEnabled(await res.text()), configured: true } });
    } catch {
      return reply.code(502).send({ error: { code: 'KV_READ_FAILED', message: 'Could not read kill-switch state.' } });
    }
  });

  /**
   * POST /api/v1/grey-hat/killswitch  body: { enabled: boolean }
   * Sets (enabled) or clears (disabled) the global kill-switch KV key. → { data: { enabled } }
   */
  fastify.post<{ Body: { enabled?: unknown } }>('/grey-hat/killswitch', async (request, reply) => {
    if (!(await assertNovatise(request, reply))) return;
    const enabled = request.body?.enabled === true;

    if (!cfKvConfigured()) {
      return reply.code(503).send({ error: { code: 'KV_NOT_CONFIGURED', message: 'Edge KV is not configured on this environment.' } });
    }

    const token = process.env['CLOUDFLARE_API_TOKEN'];
    try {
      const res = enabled
        ? await fetch(cfKvUrl(KILL_SWITCH_KEY), {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
            body: '1',
          })
        : await fetch(cfKvUrl(KILL_SWITCH_KEY), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });

      // A DELETE of an already-absent key returns 404 — that's success for "disable".
      if (!res.ok && !(res.status === 404 && !enabled)) {
        return reply.code(502).send({ error: { code: 'KV_WRITE_FAILED', message: 'Could not update the kill switch.' } });
      }

      // Audit the flip — who, when, which way (best-effort; never fails the flip).
      void recordAudit({
        actorUserId: request.userId,
        action: enabled ? 'greyhat_killswitch_enabled' : 'greyhat_killswitch_disabled',
        targetTenantId: request.tenantId,
        details: { key: KILL_SWITCH_KEY },
      });

      return reply.send({ data: { enabled } });
    } catch {
      return reply.code(502).send({ error: { code: 'KV_WRITE_FAILED', message: 'Could not update the kill switch.' } });
    }
  });
};
