# MFA Enforcement — Production & Admin Systems (SOC 2 CC6)

> **Purpose:** Define and evidence the control that **multi-factor authentication is enforced on
> every system that can touch production or customer data.** Maps to SOC 2 **CC6.1 / CC6.2 / CC6.6**.
> **Owner:** [Security Lead]. **Last updated:** 2026-06-21.
>
> **Status of this document:** the *policy and verification procedure* below are defined. The
> **console settings marked `[ ] verify` MUST be confirmed by the owner directly in each provider
> console** and the screenshot/export attached as evidence — they cannot be asserted from the
> codebase. Do not present MFA as "enforced" to an auditor until this table is fully checked with
> evidence on file.

---

## 1. Policy

1. **All human access** to any system in scope (below) **MUST require MFA.** Password-only access is
   prohibited.
2. Prefer **phishing-resistant** factors (passkeys/WebAuthn/security keys) over TOTP; TOTP over SMS.
   **SMS-only MFA is not acceptable** for production/admin access.
3. MFA is enforced **at the identity provider / console level (org policy)**, not left to individual
   user opt-in. A user must not be able to access production with a single factor.
4. **Break-glass:** at most one emergency access path per provider, MFA-protected, credentials sealed
   off-platform, its use alarmed and reviewed. Document each break-glass account in §4.
5. Enforcement is re-verified during the **quarterly access review** (see
   [`soc2-readiness-checklist.md`](soc2-readiness-checklist.md)).

---

## 2. What the codebase already shows (verified in-repo)

- **Clerk is the identity provider** for the dashboard and API. Auth is JWT/Bearer; the API has no
  alternate password path that bypasses Clerk (tenant context is derived from the Clerk JWT in
  [`apps/api/src/plugins/tenant-context.ts`](../apps/api/src/plugins/tenant-context.ts)).
- The dashboard **exposes a real 2FA/TOTP entry point** that opens Clerk's secure account UI
  (`handleEnable2FA` → `clerk.openUserProfile()` in
  [`apps/dashboard/src/pages/Profile.tsx`](../apps/dashboard/src/pages/Profile.tsx)); password and
  2FA are explicitly "managed by our secure auth provider."
- **Gap:** that path makes MFA *available* (self-service), not *enforced*. SOC 2 CC6 requires
  **org-level enforcement**. Enforcement is a Clerk dashboard policy, not application code — hence the
  verification table below.

---

## 3. Systems in scope & verification checklist

For each, confirm MFA is **enforced for all members** (not just available), attach evidence, and date it.

| # | System | What "enforced" means here | Status | Evidence (screenshot/export + date) |
|---|---|---|---|---|
| 1 | **Clerk** (dashboard + API identity, customer-facing orgs) | Org-level setting requires a second factor for all users; SMS-only disallowed; admin/owner roles require MFA. *Note:* customer tenants are also Clerk orgs — decide whether MFA is force-required for all tenants or just internal/admin orgs, and document the choice. | `[ ] verify` | |
| 2 | **GitHub** (source, CI/CD, deploy secrets) | Org setting **"Require two-factor authentication for everyone"** is ON. Critical: GitHub holds deploy tokens (`FLY_API_TOKEN`, `CLOUDFLARE_API_TOKEN`) and can push to `main`. | `[ ] verify` | |
| 3 | **Fly.io** (API + PostgreSQL, Tokyo `nrt`) | Account/org MFA enabled for every member with deploy/DB access. | `[ ] verify` | |
| 4 | **Cloudflare** (Worker, R2, KV, Pages, DNS, WAF) | Account 2FA enforced for all members; scope API tokens to least privilege. | `[ ] verify` | |
| 5 | **Upstash** (Redis) | Console MFA enabled (or SSO-with-MFA). | `[ ] verify` | |
| 6 | **Stripe** (billing) | Team MFA enforced; Stripe requires 2FA for dashboard by default — confirm no exempt members. | `[ ] verify` | |
| 7 | **Sentry** | Org "Require 2FA" enabled. | `[ ] verify` | |
| 8 | **PostHog** | Org enforces 2FA (or SSO-with-MFA). | `[ ] verify` | |
| 9 | **Resend** (transactional email — `noreply@/security@/privacy@`) | Account MFA enabled. Email-sender takeover enables phishing of customers. | `[ ] verify` | |
| 10 | **Domain registrar / DNS** for `scrollpop.online` | Registrar MFA + registrar-lock enabled (domain takeover = total compromise). | `[ ] verify` | |
| 11 | **Google/Workspace or email IdP** (if used for the above logins) | MFA enforced at the root identity used for SSO/"Sign in with Google." | `[ ] verify` | |
| 12 | **Password manager** (shared secrets vault) | MFA on the vault; recovery codes for the above stored here, not in email. | `[ ] verify` | |

> Where a provider supports **SSO into a central IdP** (item 11), enforcing MFA once at the IdP and
> requiring SSO downstream is the strongest design — fewer independent MFA configs to drift. Note per
> row whether MFA is native or inherited via SSO.

---

## 4. Break-glass accounts

| Provider | Account | Factor | Where credentials are sealed | Alerting on use |
|---|---|---|---|---|
| [e.g. Cloudflare] | [ ] | [ ] | [ ] | [ ] |

---

## 5. Evidence to retain for the auditor

- A dated screenshot/export of each provider's **org-level enforcement** setting (the policy, not an
  individual user's MFA status).
- The **per-member roster** per provider showing 100% MFA coverage (captured each quarterly review).
- This document, with §3 fully checked and dated.

---

## 6. Open actions

- [ ] Owner completes the §3 verification table with evidence.
- [ ] Decide and document the Clerk **customer-tenant** MFA posture (force-require vs. available).
- [ ] Record break-glass accounts (§4).
- [ ] Add "MFA enforcement re-verified" as a standing line item in the quarterly access review.
