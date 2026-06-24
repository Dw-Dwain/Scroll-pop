# SOC 2 Type II — Control Mapping (Readiness Pre-Assessment)

> **Purpose:** Map the AICPA Trust Services Criteria (TSC, 2017 / 2022 points of focus) to controls
> that **already exist in the ScrollPop codebase**, so we can (a) show an auditor/automation platform
> (Vanta, Drata, Secureframe) how much is already covered, and (b) see the true remaining gap — which
> for an engineering-mature product is mostly **policy, process, and evidence**, not code.
>
> **Scope:** Security (Common Criteria) is mandatory. Availability, Confidentiality, and Processing
> Integrity are recommended given the product. Privacy is optional (we cover most of it via GDPR/CCPA
> work + the DPA).
>
> **Legend:** ✅ control implemented in product · 🟡 partial / needs evidence · 🔴 gap (process/policy)
>
> Last updated: 2026-06-22 (verified against current code; SCA/Dependabot now implemented).
> Owner: [security lead]. Audit window target: [set 3–12 month observation — see
> `soc2-readiness-checklist.md` §5, recommended 6 months].
>
> **Companion docs (the execution side of this mapping):** `soc2-readiness-checklist.md` (program
> plan, owners, platform recommendation, observation window + pentest), `incident-response-plan.md`
> (CC7.4), `mfa-enforcement.md` (CC6), `security-logging-alerting-proposal.md` (CC7.2),
> `risk-register.md` (CC3/CC9).

---

## How to read the gap

ScrollPop's *technical* controls are unusually strong for its stage (closed Shadow DOM, RLS in prod,
CI security gates, encryption, strict ingest validation). SOC 2 Type II failure modes for teams like
this are almost never "the control doesn't exist" — they're **"you can't prove the control operated
continuously over the observation window."** So the work is: (1) write the policies, (2) turn on
evidence collection (a compliance-automation platform), (3) run the observation window, (4) audit.

---

## CC1 — Control Environment (governance)

| Ref | Criterion | Status | Evidence / where | Gap to close |
|---|---|---|---|---|
| CC1.1 | Integrity & ethics commitments | 🔴 | — | Code of conduct, security policy set |
| CC1.2 | Board/oversight independence | 🔴 | — | Define security ownership & oversight |
| CC1.3 | Org structure & authority | 🟡 | `CONTRIBUTING.md` (governance, review process) | Formal org chart, role definitions |
| CC1.4 | Competence (hiring, training) | 🔴 | — | Security-awareness training cadence (checklist §4) |
| CC1.5 | Accountability | 🟡 | PR review gates; branch protection. **No root `CODEOWNERS`** (verified absent 2026-06-22) | Add `CODEOWNERS` + "require code-owner review" (risk R-11) |

*These are policy/process — the largest net-new effort. A compliance platform supplies templates.*

---

## CC2 — Communication & Information

| Ref | Criterion | Status | Evidence / where | Gap |
|---|---|---|---|---|
| CC2.1 | Quality information for internal control | 🟡 | `MASTER.md`, `CTO-AUDIT.md`, `RLS-ENABLEMENT-RUNBOOK.md` | Centralize as living policies |
| CC2.2 | Internal communication of responsibilities | 🟡 | `CLAUDE.md` (absolute rules), `CONTRIBUTING.md` | Add security policy acknowledgement |
| CC2.3 | External communication (customers) | 🟡 | `docs/trust-and-security.md`, `docs/dpa.md` (draft) | Publish trust portal + status page |

---

## CC3 — Risk Assessment

| Ref | Criterion | Status | Evidence / where | Gap |
|---|---|---|---|---|
| CC3.1 | Objectives specified | 🟡 | `CTO-AUDIT.md` (8-phase audit), threat scenarios | Formal risk register |
| CC3.2 | Risk identification & analysis | 🟡 | `CTO-AUDIT.md` Phase 4/5 adversarial scenarios; security review (`project_security_review_june2026`) | Recurring risk-assessment cadence |
| CC3.3 | Fraud risk | 🔴 | — | Document fraud considerations |
| CC3.4 | Change risk assessment | ✅ | CI gates: `migration-safety`, `no-history-manipulation`, snippet size budget (`.github/workflows/ci.yml`) | Document the process around them |

---

## CC4 — Monitoring Activities

| Ref | Criterion | Status | Evidence / where | Gap |
|---|---|---|---|---|
| CC4.1 | Ongoing/separate evaluations | 🟡 | Sentry (errors), PostHog (analytics), CI on every PR | Define monitoring review cadence |
| CC4.2 | Communicate deficiencies | 🟡 | `MASTER.md` remediation log (SR-01…SR-15, CR-01…CR-08) | Formal deficiency-tracking process |

---

## CC5 — Control Activities

| Ref | Criterion | Status | Evidence / where | Gap |
|---|---|---|---|---|
| CC5.1 | Controls to mitigate risk | ✅ | RLS, sanitizers, rate limits, security headers | Map each to a risk |
| CC5.2 | Technology general controls | ✅ | CI pipeline, typecheck/lint zero-warning, tests | — |
| CC5.3 | Policies & procedures deployed | 🟡 | `CLAUDE.md` rules enforced in CI | Convert to formal policies |

---

## CC6 — Logical & Physical Access (the security heart of SOC 2)

| Ref | Criterion | Status | Evidence / where | Gap |
|---|---|---|---|---|
| CC6.1 | Logical access security (identity, least privilege) | ✅ | Clerk JWT auth (`apps/api`), dedicated `scrollpop_tenant` NOBYPASSRLS DB role separate from admin (`apps/api/src/db/ensure-rls.ts`) | Document access model |
| CC6.1 | Multi-tenant data isolation | ✅ | **RLS live in prod (15 tables)** `apps/api/src/db/ensure-rls.ts`; app-layer tenant filter `apps/api/src/plugins/tenant-context.ts` | Evidence of continuous enforcement |
| CC6.2 | Registration/authorization of users | 🟡 | Clerk org membership, role enforcement + invite flow | Document provisioning |
| CC6.3 | Role-based access / segregation | 🟡 | Tenant roles, viewer read-only UI | Document RBAC matrix |
| CC6.6 | Boundary protection (external threats) | ✅ | Cloudflare WAF/DDoS; security headers + CSP (`apps/api/src/index.ts`); CORS allow-list | — |
| CC6.6 | Anti-injection / input validation | ✅ | `packages/snippet/src/sanitize.ts` (+ `sanitize.test.ts`), strict `/e` ingest validation (`apps/api/src/index.ts`) | — |
| CC6.7 | Transmission & credential protection | ✅ | TLS/HSTS; AES-256-GCM secret encryption (`apps/api/src/lib/token-crypto.ts`, tested `security-fixes.test.ts`) | — |
| CC6.8 | Prevent/detect unauthorized software | ✅ | CI gates block disallowed APIs; `p.txt` byte-identical check; **SCA live** — `dependency-scan` gates deploys (`.github/workflows/ci.yml`), Dependabot (`.github/dependabot.yml`), CodeQL SAST (`codeql.yml`), weekly `security-audit.yml` | Mark as required status check in branch protection (checklist §6) |
| CC6.x | MFA on production/admin systems | 🟡 | Clerk is IdP; dashboard 2FA entry point (Clerk-managed). Policy + evidence procedure: `mfa-enforcement.md` | Owner to evidence org-level enforcement on every console (R-03) |
| CC6.x | Access reviews | 🔴 | — | Quarterly access review process (checklist §4) |

---

## CC7 — System Operations (detection & response)

| Ref | Criterion | Status | Evidence / where | Gap |
|---|---|---|---|---|
| CC7.1 | Vulnerability detection | ✅ (SCA) / 🟡 (pentest) | **Automated SCA live**: `dependency-scan` (CI, gates deploys), CodeQL SAST (PR + weekly), Dependabot, weekly `security-audit.yml`; security regression tests | Schedule a third-party pentest during the observation window (checklist §5) |
| CC7.2 | Monitoring for anomalies | 🟡 | Sentry, rate-limit/flood gates (`apps/api/src/index.ts`), `admin_audit_log` | Centralized security logging/alerting — plan in `security-logging-alerting-proposal.md` |
| CC7.3 | Incident evaluation | 🟡 | Incident notes (e.g. `incident-db-oom-jun12`); severity model now defined | Operate the classification (`incident-response-plan.md` §3) |
| CC7.4 | Incident response | ✅ (plan) | **Written IR + breach-notification plan: `incident-response-plan.md`** (satisfies DPA §5.7 72-hour) | Adopt formally + run an annual tabletop |
| CC7.5 | Recovery | 🟡 | `RLS-ENABLEMENT-RUNBOOK.md` has rollback; managed-DB backups | Documented BCP/DR + **tested restore drill** (R-02, checklist §4) |

---

## CC8 — Change Management

| Ref | Criterion | Status | Evidence / where | Gap |
|---|---|---|---|---|
| CC8.1 | Authorized, tested, approved changes | ✅ | PR review + CI (lint/typecheck/tests/size/migration safety) on every change (`.github/workflows/ci.yml`) | Document the SDLC policy |

*This is typically the strongest area for ScrollPop — the CI pipeline is auditor-friendly evidence.*

---

## CC9 — Risk Mitigation

| Ref | Criterion | Status | Evidence / where | Gap |
|---|---|---|---|---|
| CC9.1 | Risk mitigation (business disruption) | 🟡 | Provider redundancy, soft-deletes | Document |
| CC9.2 | Vendor/sub-processor management | 🟡 | Sub-processor list (`docs/dpa.md` Annex III) | Vendor risk-review process |

---

## Availability (A1) — recommended

| Ref | Criterion | Status | Evidence / where | Gap |
|---|---|---|---|---|
| A1.1 | Capacity monitoring | 🟡 | Edge caching (KV), Upstash, autoscaling [confirm] | Capacity policy; note the Jun-12 DB-OOM incident as a tracked risk |
| A1.2 | Backup/DR | 🟡 | Managed Postgres backups; rollback runbook | Documented + tested restore |
| A1.3 | Recovery testing | 🔴 | — | Schedule DR test |

---

## Confidentiality (C1) — recommended

| Ref | Criterion | Status | Evidence / where | Gap |
|---|---|---|---|---|
| C1.1 | Confidential data identified & protected | ✅ | Secret encryption, RLS, least-privilege roles | Data classification policy |
| C1.2 | Disposal | 🟡 | Soft-delete + retention | Document disposal procedure |

---

## Processing Integrity (PI1) — recommended (fits an analytics/events product)

| Ref | Criterion | Status | Evidence / where | Gap |
|---|---|---|---|---|
| PI1.1–PI1.3 | Inputs validated, processing complete/accurate | ✅ | Strict `/e` ingest validation, clamping, dedupe, flood gates (`apps/api/src/index.ts`); typed end-to-end with Zod (`packages/shared`) | Document data-quality controls |

---

## Remaining-gap summary (the real SOC 2 to-do list)

**Code: ~mostly done.** The technical control surface is strong. Net-new *engineering* items:
1. Enforce + evidence **MFA** on all production/admin access (CC6). 🟡 *procedure + evidence template
   ready (`mfa-enforcement.md`); owner to complete console evidence.*
2. ~~Add **automated dependency/SCA scanning**~~ ✅ **DONE (2026-06-22)** — `dependency-scan` gates all
   deploys (critical blocks anywhere; high blocks in the production tree), Dependabot security PRs,
   CodeQL SAST, and a weekly `security-audit.yml` evidence re-scan. *Remaining: list it as a required
   status check in branch protection (checklist §6).*
3. Centralized **security logging/alerting** beyond Sentry (CC7.2). 🟡 *phased plan ready
   (`security-logging-alerting-proposal.md`).*

**Process/policy: the bulk of the work** (a compliance-automation platform templates most of it):
4. Policy set: InfoSec, access control, change management, incident response, BCP/DR, vendor mgmt,
   data classification/retention, acceptable use, SDLC (CC1–CC9).
5. **Written incident-response & breach-notification plan** (CC7.4) — also satisfies DPA §5.7.
6. **Quarterly access reviews** + provisioning/deprovisioning records (CC6).
7. **Security-awareness training** + acknowledgements (CC1.4).
8. **Risk register** + recurring risk assessment (CC3).
9. **Vendor/sub-processor risk reviews** (CC9.2).
10. **Tested backup/restore + DR** (A1.2/A1.3) — note the Jun-12 DB-OOM incident as a worked example.

**Then:** run a **third-party penetration test**, start the **observation window** (Type II needs
3–12 months of the controls *operating*), and engage the auditor.

---

## Suggested sequence

1. **Pick a compliance-automation platform** (Vanta / Drata / Secureframe) — it auto-collects
   evidence from GitHub, the cloud providers, and Clerk, and supplies policy templates. This is the
   single highest-leverage step.
2. Close the **CC6 access** gaps (MFA, access reviews) and **CC7.4 IR plan** first — auditors weight
   these heavily and they're quick. *(IR plan now written: `incident-response-plan.md`.)*
3. ~~Wire **SCA/dependency scanning** into the existing CI~~ ✅ **done** — now make it a required
   status check in branch protection (`soc2-readiness-checklist.md` §6).
4. Adopt the policy set; assign owners. *(Tracked in `soc2-readiness-checklist.md` §3.)*
5. Start the **observation window**; run the **pentest** during it.
6. **ISO 27001** can largely reuse this control base (CC ≈ Annex A overlap) — pursue in parallel for
   the Japan market, alongside **Privacy Mark (Pマーク)**.
