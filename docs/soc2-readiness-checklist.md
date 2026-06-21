# SOC 2 Type II — Readiness Checklist, Owners & Program Plan

> **Purpose:** The program-management companion to [`soc2-control-mapping.md`](soc2-control-mapping.md).
> The mapping says *what's covered*; this says *what to do, in what order, who owns it, and how we
> prove it operated.* Also drives **ISO 27001 / Privacy Mark** readiness, which reuse the same control
> base. **Owner:** [Security Lead]. **Last updated:** 2026-06-22.
>
> **Scope:** Trust Services Criteria — **Security (Common Criteria)** mandatory; **Availability,
> Confidentiality, Processing Integrity** recommended (and largely already covered, per the mapping).
> Privacy via the GDPR/CCPA/APPI work + DPA.

---

## 0. Where we are

ScrollPop's **technical** control surface is strong and largely auditor-ready: RLS live in prod,
mandatory snippet sanitizers, AES-256-GCM secret encryption, closed Shadow DOM, strict ingest
validation, and a mature CI pipeline (lint/typecheck/test + `dependency-scan`, CodeQL SAST,
`no-history-manipulation`, `migration-safety`, snippet-size/integrity gates) on every change. An
append-only `admin_audit_log` records privileged actions.

The remaining work is the classic SOC 2 Type II reality: **policies, process, and continuous
evidence** — proving the controls *operated over an observation window* — plus three engineering
hardening items, two of which are now done.

**Engineering items (from the mapping's remaining-gap summary):**
| Item | Status |
|---|---|
| Automated dependency / SCA scanning as a **required check** (CC6.8/CC7.1) | ✅ **Done** — `dependency-scan` in [`ci.yml`](../.github/workflows/ci.yml) now gates all deploys (critical = block anywhere, high = block in the production tree), Dependabot raises security PRs, CodeQL SAST runs on PR + weekly, and [`security-audit.yml`](../.github/workflows/security-audit.yml) does a weekly evidence re-scan. **Remaining: mark `dependency-scan` (+ CodeQL) as required status checks in branch protection — see §6.** |
| **MFA** enforced + evidenced on prod/admin (CC6) | 🟡 In progress — policy + verification procedure in [`mfa-enforcement.md`](mfa-enforcement.md); owner must complete the console-evidence table. |
| Centralized **security logging/alerting** beyond Sentry (CC7.2) | 🟡 Proposed — phased plan in [`security-logging-alerting-proposal.md`](security-logging-alerting-proposal.md). |

---

## 1. Program sequence (recommended order)

1. **Pick a compliance-automation platform** (§2) — highest-leverage first step; it supplies policy
   templates and auto-collects evidence from GitHub, the cloud providers, and Clerk.
2. **Close the quick, high-weight controls auditors scrutinize first:**
   - MFA enforcement + evidence ([`mfa-enforcement.md`](mfa-enforcement.md)).
   - Incident-response plan ([`incident-response-plan.md`](incident-response-plan.md)) — **done, adopt + tabletop.**
   - Branch-protection required checks (§6).
3. **Adopt the policy set** (§3) and assign owners; have the team acknowledge it.
4. **Stand up evidence collection:** centralized logging (CC7.2), access-review cadence, risk
   register, training, backup/restore drill (§4).
5. **Start the observation window** (§5) and **run the pentest** during it.
6. **Audit** (Type II report). Then pursue **ISO 27001 + Privacy Mark** reusing this base (§7).

---

## 2. Compliance-automation platform — recommendation

A platform is strongly recommended over DIY: it templates the policy set, continuously collects
evidence via integrations (GitHub, Fly, Cloudflare, Clerk, AWS/GCP where relevant), runs the
background/access checks, and gives the auditor a portal. For a small, engineering-led team:

| Platform | Strengths | Watch-outs | Fit for ScrollPop |
|---|---|---|---|
| **Vanta** | Largest integration catalog, strong auditor network, fast SOC 2 path, good Clerk/GitHub/Cloud coverage; supports ISO 27001 & adds frameworks. | Priciest of the three; some checks opinionated. | **Recommended** — breadth of integrations + auditor network minimizes engineering lift; clean upgrade path to ISO 27001. |
| **Drata** | Excellent automation/UX, strong continuous-monitoring, good support; ISO 27001 supported. | Integration list slightly behind Vanta in spots. | **Strong alternative** — pick if pricing/onboarding beats Vanta in eval. |
| **Secureframe** | Often most cost-effective; solid SOC 2 + ISO; good for SMB. | Smaller ecosystem; fewer niche integrations. | **Budget pick** — viable if cost-led. |

**Recommendation:** shortlist **Vanta** and **Drata**, run a 2-week trial of each against our actual
stack (confirm native integrations for **GitHub, Fly.io, Cloudflare, Clerk, Stripe, Upstash, Sentry,
PostHog**), and choose on integration coverage + auditor-network fit + price. Default to **Vanta**
unless the trial shows Drata clearly better for us. Confirm the chosen platform also drives **ISO
27001** so the Japan effort reuses it.

> Note: a platform automates *evidence and policy scaffolding* — it does **not** replace the audit, the
> pentest, or actually operating the controls.

---

## 3. Policy set & owners

Adopt from the platform's templates, then tailor to our stack. Each needs an **owner**, an **approval
date**, an **annual review date**, and **team acknowledgement**.

| Policy | Covers | TSC | Owner | Status |
|---|---|---|---|---|
| **Information Security Policy** (umbrella) | Overall security commitments, roles, enforcement | CC1, CC2, CC5 | [Security Lead] | ☐ |
| **Access Control Policy** | Least privilege, provisioning/deprovisioning, RBAC, **MFA**, quarterly reviews | CC6 | [Security Lead] | ☐ (MFA doc started) |
| **Change Management / SDLC Policy** | PR review, CI gates, branch protection, migration safety, testing, release | CC8, CC3.4 | [Eng Lead] | ☐ (CI is the evidence) |
| **Incident Response Policy** | Severity, response lifecycle, breach notification | CC7.3–7.5 | [Security Lead] | ✅ [`incident-response-plan.md`](incident-response-plan.md) — adopt |
| **Business Continuity / DR Policy** | RPO/RTO, backups, **tested restore**, failover | A1.2/A1.3, CC7.5, CC9.1 | [Eng Lead] | ☐ (drill pending — §4) |
| **Vendor / Sub-processor Management Policy** | Onboarding risk review, annual cert re-verify, sub-processor list | CC9.2 | [Security Lead] | ☐ (list in DPA Annex III) |
| **Data Classification & Retention Policy** | Data categories, handling, **13-mo analytics retention**, soft-delete/disposal | C1, P-series | [Security Lead] + [Legal] | ☐ (retention live in product) |
| **Acceptable Use Policy** | Endpoint hygiene, credential handling, AI-tool use | CC1.4, CC6 | [Security Lead] | ☐ |
| **Risk Assessment Policy** | Methodology, cadence, register | CC3 | [Security Lead] | ✅ [`risk-register.md`](risk-register.md) — operate |
| **Code of Conduct / Ethics** | Integrity & ethics commitments | CC1.1 | [Founder] | ☐ |
| **Logging & Monitoring Policy** | What's logged, retention, alerting, review | CC7.2, CC4.1 | [Security Lead] | ☐ (proposal ready) |

---

## 4. Operating controls (the continuous-evidence work)

| Control | What "operating" looks like | Evidence | Owner | Status |
|---|---|---|---|---|
| **Quarterly access reviews** | Each quarter, review every system's user roster (Clerk, GitHub, Fly, Cloudflare, Upstash, Stripe, Sentry, PostHog, Resend); confirm least privilege + 100% MFA; remove stale access; record sign-off. | Dated review records | [Security Lead] | ☐ |
| **Provisioning / deprovisioning** | Documented onboarding/offboarding checklist; deprovision within [24h] of departure; tie to access review. | Tickets/checklist | [Security Lead] | ☐ |
| **Risk register** | Quarterly re-score + new risks from incidents/SCA/pentest. | [`risk-register.md`](risk-register.md) | [Security Lead] | ✅ operate |
| **Security-awareness training** | All staff complete security training at onboarding + annually (phishing, secure handling, IR basics); record completion. | Completion records | [Security Lead] | ☐ |
| **Tested backup/restore + DR drill** | Define RPO/RTO; perform a **restore drill** of managed Postgres into a scratch instance; verify data integrity + **RLS intact**; document. Repeat ≥ annually. | Drill report | [Eng Lead] | ☐ (R-02) |
| **Monitoring review** | Weekly scan of security signals (per CC7.2 proposal) with a sign-off. | Review log | [Security Lead] | ☐ |
| **Vendor reviews** | Annual re-verification of each sub-processor's SOC 2/ISO status. | Cert links + dates | [Security Lead] | ☐ |
| **Vulnerability management** | SCA gates green; triage Dependabot/CodeQL findings; weekly `security-audit` artifacts retained. | GitHub Security + artifacts | [Eng Lead] | ✅ operate |

---

## 5. Observation window & penetration test

- **Type II needs the controls to *operate over time*** — a **3–12 month** observation window. For a
  first report, a **3-month** window gets to a signed report fastest; **6 months** is more credible to
  enterprise buyers. **Recommendation: target a 6-month window**, but if a specific enterprise/Japan
  deal needs proof sooner, run an initial **3-month Type II** and extend next cycle.
- **Bridge the gap now:** a **SOC 2 Type I** (point-in-time design) at window start gives sales
  something to show on day one while the Type II window accrues. Optional but useful for the Japan push.
- **Penetration test:** engage a reputable third-party pentester **during the observation window**
  (not after). Scope = dashboard, API, edge Worker, and the on-site snippet (matches the trust-portal
  bug-bounty scope; out-of-scope = sub-processors, DoS). Remediate findings, **re-test**, and file the
  report + remediation as evidence. Budget one pentest per annual cycle.
- **Sequence:** platform live → policies adopted → controls operating (incl. centralized logging,
  access reviews) → **window starts** → pentest mid-window → remediate/re-test → **auditor fieldwork**
  near window end → report.

---

## 6. Required CI checks (branch-protection setting)

The in-repo half is done — `dependency-scan` gates the deploy jobs in [`ci.yml`](../.github/workflows/ci.yml).
The **repo-settings half** must be set so PRs to `main` cannot merge while a security check is red
(this is a GitHub UI/API setting, not code):

- Branch protection on `main` → **Required status checks** must include at least: **Lint, Typecheck,
  Unit Tests, Dependency Vulnerability Scan, Snippet Size Budgets, No history.\* / popstate in
  snippet, Migration Safety Check, CodeQL** (`Analyze (javascript-typescript)`).
- Enable **"Require branches to be up to date before merging."**
- (Recommended) add a root **`CODEOWNERS`** (R-11) and enable **"Require review from Code Owners"** so
  changes to the snippet, RLS, auth, and CI gates need an owner's review.
- Keep "Allow auto-merge" + "Allow Actions to create/approve PRs" enabled for the Dependabot
  auto-merge flow ([`dependabot-auto-merge.yml`](../.github/workflows/dependabot-auto-merge.yml)) —
  but note auto-merge **deliberately excludes security updates and majors** (those get human review).

> Match the **exact check names** GitHub shows after a CI run, or the requirement silently never
> applies (this has bitten branch protection here before).

---

## 7. ISO 27001 + Privacy Mark (Japan) overlap

- **ISO 27001 Annex A** controls largely overlap the SOC 2 Common Criteria — the policy set, risk
  register, access reviews, vendor management, and IR plan here are ~80% reusable. Add an ISO-specific
  **Statement of Applicability (SoA)** and **ISMS scope** document. Choose a platform (§2) that drives
  both so evidence is collected once.
- **Privacy Mark (Pマーク)** is JIS Q 15001-based and Japan-market-specific; it leans on the
  data-classification/retention + APPI work already underway (Tokyo residency done; cross-border basis
  with counsel — R-08). Pursue after SOC 2 + ISO foundations are in place.

---

## 8. Master action list (near-term, owner-assigned)

- [ ] **R-01:** Revoke leaked GitHub PATs in history; enable secret scanning + push protection. — [Owner]
- [ ] Select compliance-automation platform (Vanta/Drata trial). — [Security Lead]
- [ ] Complete MFA evidence table ([`mfa-enforcement.md`](mfa-enforcement.md)). — [Security Lead]
- [ ] Set branch-protection required checks (§6) + add `CODEOWNERS`. — [Eng Lead]
- [ ] Adopt IR plan; schedule the first tabletop. — [Security Lead]
- [ ] Implement centralized logging Phase 1. — [Security Lead]
- [ ] Run backup/restore drill; define RPO/RTO (R-02). — [Eng Lead]
- [ ] Adopt policy set (§3); collect acknowledgements. — [Security Lead]
- [ ] Stand up access-review + training cadence. — [Security Lead]
- [ ] Confirm observation window length + Type I bridge; book pentest. — [Founder]
- [ ] Counsel: finalize APPI/cross-border transfer basis (R-08, DPA §8). — [Legal]

---

## 9. Related documents

[`soc2-control-mapping.md`](soc2-control-mapping.md) · [`incident-response-plan.md`](incident-response-plan.md) ·
[`mfa-enforcement.md`](mfa-enforcement.md) · [`security-logging-alerting-proposal.md`](security-logging-alerting-proposal.md) ·
[`risk-register.md`](risk-register.md) · [`dpa.md`](dpa.md) · [`trust-and-security.md`](trust-and-security.md)
