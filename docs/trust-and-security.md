# ScrollPop Trust & Security

> **Status:** Public-facing trust-portal content — **finalized draft, pending legal/security sign-off
> before publish.** Last reviewed: 2026-06-19.
> Publish this as `trust.scrollpop.online` (mirror of competitors' trust portals, e.g. Justuno's
> `trust.justuno.com`). **Honesty rule (non-negotiable):** items marked **(in progress)** /
> **(planned)** must NEVER be presented as completed certifications until a signed report/certificate
> exists. Re-verify each sub-processor's current certification before publishing.

ScrollPop renders monetized popup overlays on our customers' websites. Because our snippet runs
on third-party sites and we process end-visitor data on our customers' behalf, security and
privacy are core to the product — not an afterthought. This page summarizes how we protect data.

---

## 1. Security at a glance

| Area | What we do |
|---|---|
| **Tenant isolation** | PostgreSQL Row-Level Security (RLS) enforced on every tenant-scoped table, plus application-layer `tenant_id` filtering (defense in depth). |
| **Snippet sandboxing** | The on-site snippet renders inside a **closed Shadow DOM** — it never injects global CSS or scripts into the host page. |
| **Injection defense** | Every tenant-controlled value is escaped/validated by a dedicated sanitizer before reaching the DOM. No `eval`, no `document.write`, no dynamic `Function()`. |
| **Encryption in transit** | TLS 1.2+ everywhere; HSTS enabled in production. |
| **Encryption at rest** | Database and object storage encrypted at rest by our infrastructure providers; third-party API credentials encrypted at the application layer with AES-256-GCM. |
| **Authentication** | Managed identity provider (Clerk) with multi-tenant organizations; JWT-based session auth. |
| **Rate limiting & abuse control** | Global and per-endpoint rate limits; per-campaign/per-IP flood gates on the unauthenticated event-ingest endpoint. |
| **Browser-navigation integrity** | We **never** manipulate browser history (`pushState`/`replaceState`/`popstate`) or hijack the back button. This is enforced automatically in our CI pipeline. |

---

## 2. Infrastructure & data residency

ScrollPop is built on hardened, SOC 2 / ISO 27001-certified cloud providers:

| Provider | Role | Their certifications |
|---|---|---|
| **Fly.io** | API hosting + managed PostgreSQL 17 (primary datastore) | SOC 2 Type II |
| **Cloudflare** | Edge delivery (Workers), object storage (R2), config cache (KV), WAF/DDoS | SOC 2 Type II, ISO 27001, ISO 27701, PCI DSS |
| **Upstash** | Redis (rate-limit counters, event-ingest buffer) | SOC 2 Type II |
| **Clerk** | Authentication & organization management | SOC 2 Type II |
| **Stripe** | Billing & payment processing (we store no card data) | PCI DSS Level 1, SOC 2 Type II |
| **Sentry** | Error monitoring | SOC 2 Type II |
| **PostHog** | Product analytics | SOC 2 Type II |
| **Resend** | Transactional email | SOC 2 Type II |

> Verify each provider's current certification before publishing; provider posture changes over time.

**Data residency:** First-party data (the primary database, API compute, and the event-ingest buffer)
is hosted in **Japan — Fly.io Tokyo (`nrt`) region, with Upstash Redis in `ap-northeast-1` (Tokyo)**.
Edge config and static assets are cached globally via Cloudflare. Error-monitoring and product-
analytics sub-processors (Sentry, PostHog) are US/EU SaaS run with IP minimisation enabled; any
resulting transfers are covered by Standard Contractual Clauses and APPI cross-border safeguards
(see §6). Customers with additional regional residency requirements should contact us.

---

## 3. Application security

- **Closed Shadow DOM rendering.** The snippet attaches a *closed* shadow root, isolating popup
  markup and styles from the host page. The host page cannot read into the popup, and the popup
  cannot leak styles onto the host page.
- **Sanitizer-first rendering.** All tenant-configurable values (text, URLs, colors, CSS lengths,
  fonts, regex targeting rules) pass through purpose-built sanitizers before being rendered.
  HTML-significant characters are escaped; URLs are restricted to `http(s)`; CSS values are
  allow-listed; targeting regexes are screened for catastrophic-backtracking (ReDoS) patterns.
- **No dangerous primitives.** No `eval()`, no `document.write()`, no `Function()` constructor in
  the on-site runtime.
- **Strict event ingest.** The public event endpoint validates every field (event type against an
  allow-list, IDs as UUIDs, URLs as `http(s)`, numerics clamped) and applies per-(campaign, IP)
  flood protection. Event data is never trusted on the basis of being received.
- **Security headers.** Responses set `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, a restrictive `Content-Security-Policy`, and HSTS in production.
- **Accessibility.** Popups follow the WCAG 2.1 modal-dialog pattern: ARIA `role="dialog"` +
  `aria-modal`, keyboard focus management, and a keyboard-discoverable escape (`Esc` / close
  button) so we never create a keyboard trap (WCAG 2.1 SC 2.1.2).

---

## 4. Continuous security in our build pipeline

Every change is gated in CI before it can ship:

- **No history manipulation** — automated check rejects any `history.pushState`,
  `history.replaceState`, `popstate` listener, or back-button-capture code. This keeps us
  compliant with Google's June 2026 "back button hijacking" spam policy by construction.
- **Snippet size budgets** — the on-site bundle is capped (core ≤ 13 KB gzipped, with per-chunk caps)
  so we can never ship bloated or surprising code to customer sites.
- **Migration safety** — destructive database migration patterns are flagged.
- **Lint, typecheck, and security regression tests** — run on every pull request with zero-warning
  enforcement.

---

## 5. Access control & operations

- Production access is restricted to authorized engineers and follows least-privilege.
- Secrets are managed via provider secret stores and environment variables — never committed to
  source control.
- The database uses a dedicated low-privilege application role that **cannot** bypass Row-Level
  Security, separate from the migration/admin role.
- Administrative actions are recorded in an append-only audit log (actor, action, timestamp).
- MFA enforcement on production/admin systems, a formal access-review cadence, documented
  onboarding/offboarding, centralized security logging, and incident-response SLAs are being
  formalized as part of our SOC 2 program (§7). **(in progress — not yet represented as complete.)**

---

## 6. Privacy & compliance

- **Data Processing Agreement (DPA).** Available to all customers — see `docs/dpa.md`. ScrollPop
  acts as a **processor** for end-visitor data collected through popups on customer sites.
- **Consent signals.** The snippet honors Global Privacy Control (GPC) and integrates with Google
  Consent Mode v2 and a host-page consent flag; when consent is absent, popups may still render but
  analytics are not recorded and no visitor identifier is persisted. A per-tenant strict opt-in
  mode is available.
- **GDPR / CCPA / CPRA.** We support data-subject requests (access, deletion). Soft-delete with
  retention windows protects against accidental loss while honoring deletion obligations.
- **Japan (APPI).** First-party personal data is hosted in **Japan (Tokyo)** as of June 2026, which
  removes the cross-border question for the data we control. Remaining APPI readiness — the
  cross-border transfer basis for US/EU sub-processors and cookie/tag-consent handling — is being
  finalized with counsel (§7). **(in progress — pending legal review; do not represent as complete.)**

---

## 7. Certifications & roadmap

We hold ourselves to enterprise security standards and are formalizing them through independent audit:

| Item | Status | Target |
|---|---|---|
| SOC 2 Type II | **(in progress)** | [set date] |
| ISO 27001 | **(in progress)** | [set date] |
| Privacy Mark (Pマーク) — for Japan market | **Planned** | [set date] |
| Built-in consent-management banner | **Planned** | [set date] |
| Published DPA + sub-processor list | **Draft ready** (`docs/dpa.md`) | [set date] |
| Regional data residency (EU / Japan) | **Evaluating** | [set date] |
| Third-party penetration test | **Planned** | [set date] |

> **Honesty rule:** Until each audit produces a signed report/certificate, present these as
> "in progress," never as "certified." Misrepresenting certification status is itself a legal and
> reputational risk.

---

## 8. Reporting a vulnerability

We welcome reports from security researchers. Email **security@scrollpop.online** with details and
reproduction steps. We aim to acknowledge within **2 business days**. Please do not publicly disclose
until we have confirmed and shipped a fix.

**Safe harbor.** We will not pursue legal action against researchers who act in good faith: test only
against accounts and data you own, avoid privacy violations and service degradation, never access or
modify other users' data, and allow reasonable time to remediate before disclosure. **In scope:** the
dashboard, API, edge Worker, and the on-site snippet. **Out of scope:** third-party sub-processors,
volumetric/DoS testing, social engineering, and physical attacks.

---

## 9. Contact

- Security & trust questions: **security@scrollpop.online**
- Privacy / DPA requests: **privacy@scrollpop.online**
- Status page: **planned** (`status.scrollpop.online`)
