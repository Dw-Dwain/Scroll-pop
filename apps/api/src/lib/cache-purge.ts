/**
 * Shared edge-config cache purge.
 *
 * A campaign's served config is cached in two places:
 *  1. Cloudflare KV (`config:v2:{publicKey}`) — the production edge cache the Worker reads.
 *  2. Redis (`sp_config:{publicKey}`) — the local/dev `/c/` route's cache.
 *
 * When a campaign is activated/paused/changed, both must be invalidated so the change
 * propagates immediately instead of lingering for up to the 60s TTL. Best-effort — never
 * throws into the caller's request path.
 *
 * This is the same KV-delete logic as the internal `/cache/:publicKey` route, extracted so
 * the campaign status handlers can reuse it (CTO-AUDIT Phase 4, Finding 2 / P0-5).
 */
import { redis } from '../index.js';

export async function purgeSiteConfigCache(publicKey: string): Promise<void> {
  if (!publicKey) return;

  // 1. Local/dev Redis config cache.
  if (redis) {
    try {
      await redis.del(`sp_config:${publicKey}`);
    } catch {
      /* non-fatal */
    }
  }

  // 2. Production edge cache (Cloudflare KV). No-op if CF isn't configured (e.g. local dev).
  const accountId = process.env['CLOUDFLARE_ACCOUNT_ID'];
  const apiToken = process.env['CLOUDFLARE_API_TOKEN'];
  const kvNamespaceId = process.env['CLOUDFLARE_KV_NAMESPACE_ID'];
  if (!accountId || !apiToken || !kvNamespaceId) return;

  // Must match the key the Worker writes/reads in apps/worker/src/index.ts.
  const kvKey = `config:v2:${publicKey}`;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${kvNamespaceId}/values/${encodeURIComponent(kvKey)}`;
  try {
    await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${apiToken}` } });
  } catch {
    /* non-fatal — the 60s TTL will expire the stale entry as a fallback */
  }
}
