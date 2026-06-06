# ScrollPop — Security & Code Quality Remediation Plan

> **Created:** June 6, 2026  
> **Source:** Automated code review of all uncommitted changes (P1-8, P1-9, P2-14, P3-2 through P3-12 work)  
> **Scope:** 15 findings ranked by severity + 7 production blockers called out separately  
> **Status:** ✅ SR-01 → SR-15 all fixed (June 6, 2026). API typechecks clean; 71/71 tests pass.
> Tests added for SR-01, SR-05, SR-10, SR-11; existing ESP/integrations tests updated for the
> new adapter result contract (SR-02) and PUT /integrations 404 (SR-13).

---

## Production Blockers — Fix These First (7 items)

These 7 items are **hard blocks** on opening to real paying customers or untrusted operators.
Nothing ships to production until all 7 are green.

| # | ID | Severity | Finding | File | Fix |
|---|---|---|---|---|---|
| 1 | SR-01 | 🔴 **Critical** | SSRF — outbound webhook URL not IP-blocked, follows redirects | `outbound-webhook.ts:67` | Private-IP blocklist + `redirect: 'error'` + re-validate at fire time |
| 2 | SR-02 | 🟠 **High** | `/integrations/test` always returns `ok:true` even for wrong API key | `integrations.ts:121`, `esp.ts:74` | Return result type from adapters instead of absorbing errors; or throw on non-2xx in test context |
| 3 | SR-03 | 🟠 **High** | `DELETE /me` orphans shared org — no sole-owner guard | `me.ts:71` | Count remaining owners before deleting; 409 if user is last owner |
| 4 | SR-04 | 🟠 **High** | Dirty-delete window — DB row deleted before Clerk `deleteUser()` | `me.ts:74` | Reverse order: call `clerkClient.users.deleteUser` first, then DB cleanup; or wrap in a compensating transaction |
| 5 | SR-05 | 🟡 **Medium** | Mailchimp `serverPrefix` injected unchecked into fetch URL — auth header sent to attacker domain | `esp.ts:92` | Validate `serverPrefix` matches `/^[a-z]{2}\d+$/i` before constructing URL |
| 6 | SR-06 | 🟡 **Medium** | Coupon redemption TOCTOU — concurrent events redeem past `maxUses` | `index.ts:809` | Replace read-then-increment with atomic `UPDATE … WHERE uses < max_uses RETURNING id`; reject if 0 rows updated |
| 7 | SR-07 | 🟡 **Medium** | Auto-responder `htmlBody` delivered to email clients without sanitization — stored XSS in outbound email | `index.ts:710` | Sanitize with `sanitize-html` (allowlist tags: p, br, b, i, a, ul, li, img) before passing to `sendEmail()` |

---

## All 15 Findings — Full Remediation Plan

### SR-01 — SSRF via Outbound Webhook URL
**Severity:** 🔴 Critical  
**File:** `apps/api/src/routes/outbound-webhook.ts` line 67  
**CVSS-like:** High impact (internal service access), Low complexity, Network exploitable by any operator  

**What's broken:**
`fireOutboundWebhook` calls `fetch(url)` where `url` comes from a DB JSONB column with no private-IP check. The Zod schema on write only validates `http(s)://` prefix, not the destination host. Node's `fetch` follows 302 redirects by default (`redirect: 'follow'`), so a public URL redirecting to `http://169.254.169.254/latest/meta-data/` succeeds. `AbortSignal.timeout(5000)` does not prevent the request — metadata endpoints respond in <100ms.

**Fix (two layers, both required):**
```typescript
// Layer 1: at storage time in OutboundWebhookBody refine()
import dns from 'node:dns/promises';
import net from 'node:net';

const PRIVATE_RANGES = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^169\.254\./, /^::1$/, /^fc00:/i, /^fe80:/i, /^0\.0\.0\.0$/,
];

async function isPublicUrl(rawUrl: string): Promise<boolean> {
  try {
    const { hostname } = new URL(rawUrl);
    const { address } = await dns.lookup(hostname);
    return !PRIVATE_RANGES.some((r) => r.test(address));
  } catch { return false; }
}

// Layer 2: inside fireOutboundWebhook before fetch()
if (!await isPublicUrl(url)) return; // silently skip — operator misconfiguration
await fetch(url, {
  method: 'POST',
  headers,
  body: payload,
  signal: AbortSignal.timeout(5000),
  redirect: 'error',  // ← prevents open-redirect bypass
});
```
> Note: DNS-level blocking must be done at fire time (layer 2), not only at write time (layer 1) — a hostname that was public when saved can move to a private IP later (DNS rebinding).

---

### SR-02 — POST /integrations/test Always Returns Success
**Severity:** 🟠 High  
**Files:** `apps/api/src/routes/integrations.ts:121`, `apps/api/src/lib/esp.ts:74`  

**What's broken:**
`syncToKlaviyo` and `syncToMailchimp` are designed to "never throw" (the comment says so explicitly). They swallow all errors internally. The test endpoint's `try/catch` wrapping them therefore never catches anything, and always falls through to `reply.send({ data: { ok: true } })`.

**Fix — add a test-mode parameter to the adapters:**
```typescript
// esp.ts — add testMode flag
export async function syncToKlaviyo(opts: {
  apiKey: string; listId: string; contact: EspContact; testMode?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  // ...
  const res = await fetch(...);
  if (!res.ok && res.status !== 202) {
    const body = await res.text().catch(() => '');
    if (opts.testMode) return { ok: false, error: `Klaviyo ${res.status}: ${body.slice(0, 200)}` };
    console.warn(`[esp] Klaviyo sync failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return { ok: true };
}
// integrations.ts — test endpoint checks the result
const result = await syncToKlaviyo({ ..., testMode: true });
if (!result.ok) {
  return reply.code(502).send({ error: { code: 'ESP_ERROR', message: result.error } });
}
```
> Ingest path still uses `testMode: false` (default) — stays best-effort.

---

### SR-03 — DELETE /me Orphans Shared Org
**Severity:** 🟠 High  
**File:** `apps/api/src/routes/me.ts:71`  

**What's broken:**
Any user — including the sole owner of a multi-seat org — can call `DELETE /me`. Their `tenantMembers` rows across all orgs are removed unconditionally. If they were the last `owner` of a shared org, that org is permanently ownerless with no recovery path.

**Fix:**
```typescript
// Before any DB mutation, check for sole-owner tenants
const ownedTenants = await db
  .select({ tenantId: tenantMembers.tenantId, orgId: tenants.clerkOrgId })
  .from(tenantMembers)
  .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
  .where(and(
    eq(tenantMembers.userId, user.id),
    eq(tenantMembers.role, 'owner'),
    isNull(tenants.deletedAt),
    not(like(tenants.clerkOrgId, 'personal_%')), // exclude personal tenants
  ));

for (const t of ownedTenants) {
  const otherOwners = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(tenantMembers)
    .where(and(
      eq(tenantMembers.tenantId, t.tenantId),
      eq(tenantMembers.role, 'owner'),
      not(eq(tenantMembers.userId, user.id)),
    ));
  if ((otherOwners[0]?.count ?? 0) === 0) {
    return reply.code(409).send({
      error: {
        code: 'SOLE_OWNER',
        message: `You are the only owner of org "${t.orgId}". Transfer ownership before deleting your account.`,
      },
    });
  }
}
```

---

### SR-04 — Dirty-Delete Window in DELETE /me
**Severity:** 🟠 High  
**File:** `apps/api/src/routes/me.ts:74`  

**What's broken:**
The DB user row is hard-deleted (line 74) before `clerkClient.users.deleteUser()` is called (line 77). A network timeout or process crash after line 74 leaves the Clerk user alive with no DB row. On next login, `tenant-context.ts` inserts a **new UUID** — all prior data (leads, audit logs, campaign memberships) is orphaned.

**Fix — reverse the order:**
```typescript
// 1. Delete from Clerk FIRST (fires the user.deleted webhook which does cleanup)
try {
  await clerkClient.users.deleteUser(user.clerkUserId);
} catch (err) {
  // If Clerk deletion fails, abort — do not touch the DB
  request.log.error({ err }, '[me] Clerk user deletion failed — aborting account delete');
  return reply.code(502).send({ error: { code: 'CLERK_ERROR', message: 'Failed to delete account from auth provider' } });
}

// 2. DB cleanup only after Clerk confirms deletion
// (The user.deleted webhook will also run cleanup — DB ops are idempotent)
await db.update(tenants)
  .set({ deletedAt: new Date(), updatedAt: new Date() })
  .where(eq(tenants.clerkOrgId, `personal_${user.clerkUserId}`));
await db.delete(tenantMembers).where(eq(tenantMembers.userId, user.id));
await db.delete(users).where(eq(users.id, user.id));
return reply.code(204).send();
```
> The `user.deleted` webhook will also fire and re-run the DB cleanup — all operations are idempotent (WHERE clauses find nothing on second pass).

---

### SR-05 — Mailchimp serverPrefix Injection
**Severity:** 🟡 Medium  
**File:** `apps/api/src/lib/esp.ts:92`  

**What's broken:**
`serverPrefix = apiKey.split('-').pop()` is used unvalidated to construct a fetch URL. A crafted key `xxxxxxxx-us1.evil.com/path?q=` makes the fetch go to `us1.evil.com` — the `Authorization: Basic` header containing the full API key is sent to the attacker.

**Fix:**
```typescript
const serverPrefix = apiKey.split('-').pop();
// Mailchimp data center codes are always: 2 letters + 1-2 digits (us1, us6, eu1, etc.)
if (!serverPrefix || !/^[a-z]{2}\d{1,2}$/i.test(serverPrefix)) {
  console.warn('[esp] Mailchimp API key has invalid format — skipping sync');
  return;
}
```

---

### SR-06 — Coupon Redemption TOCTOU
**Severity:** 🟡 Medium  
**File:** `apps/api/src/index.ts:~809`  

**What's broken:**
Read (`coupon.uses >= coupon.maxUses`) and write (`SET uses = uses + 1`) are separate operations. Concurrent duplicate events both read `uses = maxUses - 1`, both pass the guard, both increment — final value exceeds `maxUses`. A single-use coupon can be redeemed multiple times.

**Fix — atomic conditional increment:**
```typescript
// Replace the read-then-increment pattern with:
const result = await db
  .update(coupons)
  .set({ uses: drizzleSql`${coupons.uses} + 1` })
  .where(and(
    eq(coupons.id, coupon.id),
    coupon.maxUses != null
      ? drizzleSql`${coupons.uses} < ${coupon.maxUses}`
      : drizzleSql`true`,
    coupon.expiresAt != null
      ? drizzleSql`${coupons.expiresAt} > NOW()`
      : drizzleSql`true`,
  ))
  .returning({ id: coupons.id });

if (result.length === 0) return; // guard failed atomically — coupon exhausted or expired
```

---

### SR-07 — Auto-Responder HTML Not Sanitized (XSS in Outbound Email)
**Severity:** 🟡 Medium  
**File:** `apps/api/src/index.ts:710`  

**What's broken:**
The campaign `autoResponder.htmlBody` (stored JSONB, operator-supplied, max 50KB) is passed directly to `sendEmail({ html: htmlBody })` with no tag allowlist. A malicious or compromised operator account can deliver `<script>`, XSS, tracking pixels, or phishing content to every subscriber.

**Fix:**
```typescript
// In apps/api — install: pnpm add sanitize-html
import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = ['p', 'br', 'b', 'i', 'strong', 'em', 'a', 'ul', 'ol', 'li',
                      'h1', 'h2', 'h3', 'img', 'div', 'span', 'table', 'tr', 'td'];
const ALLOWED_ATTR = {
  'a': ['href', 'target', 'rel'],
  'img': ['src', 'alt', 'width', 'height'],
  '*': ['style'],
};

const safeHtml = sanitizeHtml(htmlBody, {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTR,
  allowedSchemes: ['https', 'http', 'mailto'],
});
await sendEmail({ to: recipientEmail, subject, html: safeHtml });
```

---

### SR-08 — Mailchimp HTTP 400 Silently Swallowed
**Severity:** 🟡 Medium  
**File:** `apps/api/src/lib/esp.ts:118`  

**What's broken:**
`if (!res.ok && res.status !== 400)` treats ALL Mailchimp 400 responses as non-fatal. Mailchimp returns 400 for: invalid API key, bad list ID, malformed email, compliance state — not only for "member already exists." An operator with a wrong API key gets zero error output on the live ingest path.

**Fix:**
```typescript
if (!res.ok) {
  const body = await res.text().catch(() => '');
  const bodyJson = JSON.parse(body).catch?.() ?? {};
  // "Member Exists" is the only 400 we treat as non-fatal
  const isMemberExists = res.status === 400 &&
    (bodyJson?.title === 'Member Exists' || body.includes('Member Exists'));
  if (!isMemberExists) {
    console.warn(`[esp] Mailchimp sync failed (${res.status}): ${body.slice(0, 200)}`);
  }
}
```

---

### SR-09 — No Per-Route Rate Limit on POST /integrations/test
**Severity:** 🟡 Medium  
**File:** `apps/api/src/routes/integrations.ts:92`  

**What's broken:**
Global limit is 200 req/min per IP. Authenticated users can fire up to 200 calls/min to `/integrations/test` with arbitrary `testEmail` values, subscribing victims to the operator's own ESP list without their consent.

**Fix:**
```typescript
fastify.post('/integrations/test', {
  config: { rateLimit: { max: 5, timeWindow: '1 minute', keyGenerator: (req) => req.tenantId } },
}, async (request, reply) => { ... });
```
> Key by `tenantId` (not IP) so multi-IP actors don't bypass it.

---

### SR-10 — Shopify/Other Platform Campaigns Bypass Origin Gate
**Severity:** 🟡 Medium  
**File:** `apps/api/src/index.ts:544` (eventOriginAllowed)  

**What's broken:**
`if (meta.platform !== 'html' && meta.platform !== 'wordpress') return true` — all Shopify, donorbox, gofundme, and "other" platform campaigns skip origin enforcement entirely. An attacker who knows the campaignId of any Shopify campaign can forge unlimited impression events with random `pageUrls` to exhaust that tenant's monthly view quota or poison their analytics.

**Fix:**
```typescript
function eventOriginAllowed(pageUrl: string | null, meta: CampaignMeta): boolean {
  if (!pageUrl) return true; // fail open — no URL to check
  let host: string;
  try { host = new URL(pageUrl).hostname; } catch { return true; }

  const rd = registrableDomain(host);

  // All platforms: check against stored domain first
  if (meta.domain && rd === registrableDomain(meta.domain)) return true;

  // Shopify: also check against shopifyShop
  if (meta.shopifyShop) {
    const shopHost = meta.shopifyShop.includes('.')
      ? meta.shopifyShop
      : `${meta.shopifyShop}.myshopify.com`;
    if (rd === registrableDomain(shopHost)) return true;
  }

  // WordPress: also check wpSiteUrl
  if (meta.wpSiteUrl) {
    try {
      if (rd === registrableDomain(new URL(meta.wpSiteUrl).hostname)) return true;
    } catch {}
  }

  // For "other" platforms with no stored domain, fail open
  if (!meta.domain && !meta.shopifyShop && !meta.wpSiteUrl) return true;

  return false;
}
```

---

### SR-11 — Frequency Cap Key Mismatch in Snippet
**Severity:** 🟢 Low-Medium  
**File:** `packages/snippet/src/main.ts:1110`  

**What's broken:**
`setFrequencyCap()` writes to `localStorage` key `_sp_${campaignId}`. The two-click dismiss flow calls `localStorage.removeItem(_sp_fr_${campaign.id})` — note the `fr_` infix that doesn't match. The `removeItem` call is always a no-op; the cap is never cleared.

**Fix:**
```typescript
// Remove the _fr_ infix — use the same key written by setFrequencyCap
localStorage.removeItem(`_sp_${campaign.id}`);
```

---

### SR-12 — Redis L2 Cache: siteId/platform Cast from Potentially-Undefined
**Severity:** 🟢 Low  
**File:** `apps/api/src/index.ts:465`  

**What's broken:**
Only `tenantId` is checked (`typeof h['tenantId'] === 'string'`) before using the Redis hash. `siteId` and `platform` are cast directly with `as string`. A partially-written hash (e.g., write interrupted mid-HSET) produces `siteId: undefined` which TypeScript silently coerces to the string `"undefined"`. This gets stored in L1 cache and returned as a real siteId.

**Fix:**
```typescript
if (h && typeof h['tenantId'] === 'string' &&
        typeof h['siteId']    === 'string' &&
        typeof h['platform']  === 'string') {
  // safe to cast all fields
}
```

---

### SR-13 — PUT /integrations Silent No-Op When Tenant Missing
**Severity:** 🟢 Low  
**File:** `apps/api/src/routes/integrations.ts:83`  

**What's broken:**
When `tenant` is null (soft-deleted mid-request or bad JWT), the UPDATE fires with 0 affected rows and returns HTTP 200 with an empty config. The caller has no way to know the write was a no-op.

**Fix:**
```typescript
const tenant = await db.query.tenants.findFirst({ ... });
if (!tenant) {
  return reply.code(404).send({ error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' } });
}
```

---

### SR-14 — Webhook user.created Sets email='' for Phone/OAuth Accounts
**Severity:** 🟢 Low  
**File:** `apps/api/src/routes/webhooks.ts:155`  

**What's broken:**
`email = data.email_addresses[0]?.email_address ?? ''`. A Clerk user with only a phone number or social OAuth (no email shared) has `email_addresses = []`. Empty string is stored in `users.email`. Subsequent ESP sync, auto-responder, and admin display operate on a blank email with no error.

**Fix:**
```typescript
const email = data.email_addresses[0]?.email_address;
if (!email) {
  // Phone-only or social accounts — use a synthetic placeholder
  fastify.log.info({ clerkUserId: data.id }, '[webhook] user has no email — using placeholder');
  // Skip upsert or use `${data.id}@noemail.scrollpop.local` as a synthetic non-deliverable address
  break;
}
```

---

### SR-15 — revokeAllUserSessions Duplicated Between me.ts and webhooks.ts
**Severity:** 🟢 Low  
**File:** `apps/api/src/routes/me.ts:60`, `apps/api/src/routes/webhooks.ts:13`  

**What's broken:**
`webhooks.ts` defines a named `revokeAllUserSessions()` helper with a structured `warn` log on failure. `me.ts` inlines an equivalent block with a bare `catch {}` — failures are completely silent. Any future change to the helper (retry logic, audit logging) must be applied in two places.

**Fix:**
```typescript
// Export the helper from webhooks.ts (or extract to apps/api/src/lib/auth.ts)
export { revokeAllUserSessions } from './webhooks.js';

// me.ts — import and use the shared helper
import { revokeAllUserSessions } from './webhooks.js';
// ...
await revokeAllUserSessions(user.clerkUserId, request.log);
```

---

## Sprint Plan for June 7, 2026

### Block A — Security Blockers (~4h, must ship before any real operators)
Work through SR-01 → SR-07 in order. Each has a code snippet above.

| Order | ID | File(s) | Est. |
|---|---|---|---|
| 1 | SR-01 | `outbound-webhook.ts` | 45 min |
| 2 | SR-02 | `esp.ts`, `integrations.ts` | 30 min |
| 3 | SR-03 | `me.ts` | 30 min |
| 4 | SR-04 | `me.ts` | 20 min |
| 5 | SR-05 | `esp.ts` | 10 min |
| 6 | SR-06 | `index.ts` | 20 min |
| 7 | SR-07 | `index.ts`, `package.json` | 25 min |

### Block B — Medium + Low (~2.5h, before untrusted public traffic)
| Order | ID | File(s) | Est. |
|---|---|---|---|
| 8 | SR-08 | `esp.ts` | 15 min |
| 9 | SR-09 | `integrations.ts` | 10 min |
| 10 | SR-10 | `index.ts` | 30 min |
| 11 | SR-11 | `packages/snippet/src/main.ts` | 5 min |
| 12 | SR-12 | `index.ts` | 10 min |
| 13 | SR-13 | `integrations.ts` | 10 min |
| 14 | SR-14 | `webhooks.ts` | 10 min |
| 15 | SR-15 | `me.ts`, `webhooks.ts` | 20 min |

### Block C — Remaining Tracker Items (ops + P1-14)
These run in parallel with or after the security fixes.

| ID | Item | Owner | Est. |
|---|---|---|---|
| P0-2 | Set Stripe keys in Render env vars | Ops | 2h |
| P2-18 | `api.scrollpop.online` CNAME in Cloudflare DNS | Ops | 30 min |
| P3-3 | `cdn.scrollpop.online` custom domain on R2 bucket | Ops | 30 min |
| P3-5 | `pnpm build` + `wrangler pages deploy` for marketing site | Ops | 30 min |
| P1-14 | Shopify App Store submission | Product | 2h |

---

## Tests to Add Alongside Fixes

For each security fix, a corresponding test should be added to `apps/api/src/index.test.ts`:

| Fix | Test |
|---|---|
| SR-01 SSRF blocklist | `fireOutboundWebhook` rejects `http://169.254.169.254/`, `http://localhost/`, `http://10.0.0.1/` |
| SR-02 test endpoint | Wrong Klaviyo/Mailchimp key returns 502 (stub ESP adapter to return error) |
| SR-03 sole-owner | `DELETE /me` returns 409 when user is only owner of a shared org |
| SR-05 serverPrefix | `syncToMailchimp` returns early (no fetch) for key without valid datacenter suffix |
| SR-06 coupon TOCTOU | Concurrent coupon redemptions do not exceed `maxUses` |
| SR-10 origin gate | Shopify campaign events from wrong origin are blocked (not auto-allowed) |
| SR-11 freq cap key | Frequency cap localStorage key used in removeItem matches key written by setFrequencyCap |

---

*Document created June 6, 2026. Cross-referenced against code review output (15 findings). All items actionable with code snippets above. No architectural changes required — all are targeted one-file or two-file fixes.*
