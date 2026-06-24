# ScrollPop — Security Incident Response & Breach Notification Plan

> **Status:** Working plan for review/adoption. Satisfies **SOC 2 CC7.3–CC7.5** and the
> **DPA §5.7** breach-notification obligation (notify Customer "without undue delay and in any
> case within 72 hours" of becoming aware of a Personal Data Breach).
> **Owner:** [Security Lead]. **Approver:** [CTO/Founder]. **Last updated:** 2026-06-21.
> Review cadence: at least annually and after any Sev-1/Sev-2 incident.

This plan is intentionally lightweight and executable by a small team. It is the document an
auditor reads to confirm we have a *defined, repeatable* response — and the runbook the on-call
engineer follows at 3 a.m. Keep it short enough to actually use.

---

## 1. Scope

Applies to any **security incident** affecting ScrollPop systems or data: the API (`scrollpop-api`,
Fly.io Tokyo `nrt`), the edge Worker + R2/KV (Cloudflare), the dashboard (Cloudflare Pages), the
on-site snippet, the PostgreSQL/Timescale datastore, Upstash Redis, and all sub-processors listed in
[`dpa.md`](dpa.md) Annex III. Covers confidentiality, integrity, and availability events — including
suspected ones.

A **Personal Data Breach** (DPA / GDPR Art. 4(12)) is any incident leading to accidental or unlawful
destruction, loss, alteration, unauthorized disclosure of, or access to, Personal Data — including
End-Visitor data (visitor/session IDs, IP-derived country, page URLs, interaction events, and any
data a visitor submitted via a popup form) and Customer-user account data.

---

## 2. Roles

| Role | Responsibility | Who |
|---|---|---|
| **Incident Commander (IC)** | Owns the incident end-to-end: declares severity, coordinates, makes the containment call, decides on notification. | [Security Lead] (primary) / [CTO] (backup) |
| **Technical Lead** | Investigates, contains, eradicates, recovers. May be the IC on a small team. | On-call engineer |
| **Comms / Customer Lead** | Drafts and sends customer + regulator notifications; owns status page. | [Founder] / [Security Lead] |
| **Privacy/Legal liaison** | Breach-notification legal assessment (GDPR/CCPA/APPI), regulator contact, counsel engagement. | [Legal counsel] (external until hired) |
| **Scribe** | Maintains the incident timeline (decisions, timestamps, actions) for the post-mortem and evidence. | Anyone not IC/Tech Lead |

> Small-team reality: one person may wear several hats. The non-negotiable is that **one named IC
> owns the incident** and **the timeline is written down as it happens**.

---

## 3. Severity classification

| Sev | Definition | Examples | Target response |
|---|---|---|---|
| **Sev-1 (Critical)** | Confirmed breach of Personal Data, cross-tenant data exposure, full auth bypass, key/secret compromise, or total outage. | RLS bypass leaking another tenant's leads; leaked `DATABASE_URL` / Clerk secret; snippet serving attacker code. | Immediate. IC paged. Containment within **1 hour**. |
| **Sev-2 (High)** | Likely-exploitable vuln or limited exposure; significant degradation; suspected breach pending confirmation. | Stored XSS reaching a customer site; auth flaw without confirmed exploitation; partial outage. | Within **4 hours**. |
| **Sev-3 (Medium)** | Security weakness, no confirmed exposure; isolated/contained issue. | High-severity dependency advisory in the runtime tree; misconfiguration caught before exploitation. | Within **2 business days**. |
| **Sev-4 (Low)** | Informational / hygiene. | Dev-only dependency advisory; spam vuln report; policy deviation. | Tracked in the [risk register](risk-register.md); next sprint. |

When in doubt, **classify up**. A suspected Personal Data Breach is **Sev-1 or Sev-2 until proven
otherwise**, because the DPA §5.7 / GDPR 72-hour clock starts when we become *aware*, not when we
finish confirming.

---

## 4. Detection sources

Incidents surface from:
- **Sentry** alerts (API/Worker/dashboard error spikes, unhandled exceptions).
- **CI security gates** failing on `main` (`dependency-scan`, `security-audit` scheduled SCA,
  CodeQL, `no-history-manipulation`, `migration-safety`).
- **Dependabot** security alerts.
- **`admin_audit_log`** anomalies (unexpected privileged actions — see
  [`apps/api/src/lib/audit.ts`](../apps/api/src/lib/audit.ts)).
- **Rate-limit / flood-gate** spikes on the `/e` ingest endpoint.
- **Provider alerts** (Fly.io, Cloudflare, Upstash, Clerk, Stripe).
- **External report** to `security@scrollpop.online` (see [`trust-and-security.md`](trust-and-security.md) §8 — 2-business-day ack target).

> **CC7.2 gap acknowledged:** detection today is per-tool, not centralized. The consolidation plan
> is [`security-logging-alerting-proposal.md`](security-logging-alerting-proposal.md).

---

## 5. Response lifecycle (NIST-aligned)

### 5.1 Identify & declare
1. First responder opens an incident channel (e.g. `#inc-YYYYMMDD-<slug>`), assigns an **IC**, and
   starts the **timeline** (UTC timestamps).
2. IC sets a **provisional severity** and whether **Personal Data may be involved** (this starts the
   72-hour assessment clock — record the "became aware" timestamp explicitly).

### 5.2 Contain
- **Short-term:** stop the bleeding — revoke the compromised credential/token, disable the affected
  account/integration, flip the relevant kill-switch (e.g. the affiliate ad-close KV kill-switch),
  block the abusive IP/range at Cloudflare, or roll back the offending deploy.
- **Snippet integrity:** if the on-site snippet is implicated, the CI integrity gate guarantees the
  edge serves exactly the reviewed `apps/worker/src/p.txt`. Re-deploy from a known-good commit; the
  size/integrity gates re-assert on the way out.
- **Preserve evidence before destroying state:** snapshot logs, the `admin_audit_log`, and DB state;
  capture the offending request/payload. Containment should not erase forensics.

### 5.3 Eradicate
- Remove the root cause (patch the vuln, rotate ALL potentially-exposed secrets, close the access
  path). Rotate broadly when in doubt — partial rotation is a recurring breach pattern.

### 5.4 Recover
- Restore service from a known-good state; verify with the standard CI gates + a smoke test.
- For data loss/corruption, follow the **backup/restore** procedure (managed Postgres PITR — see the
  [readiness checklist](soc2-readiness-checklist.md) "Tested backup/restore"). Confirm RLS and tenant
  isolation are intact post-restore.
- Heightened monitoring for a defined watch period before standing down.

### 5.5 Post-incident (within 5 business days)
- **Blameless post-mortem:** timeline, root cause, what worked, what didn't.
- **Corrective actions** with owners + due dates, logged in the [risk register](risk-register.md) and
  tracked to closure (this is the CC4.2 "communicate & remediate deficiencies" evidence).
- Update this plan / runbooks if the response revealed a gap.

---

## 6. Breach-notification decision & timeline

> **The clock starts at AWARENESS of a likely Personal Data Breach, not at confirmation.**
> Run this assessment in parallel with containment — do not serialize it after recovery.

```
Personal Data Breach suspected?
        │ yes
        ▼
Record "became aware" timestamp ──► 72-hour clock starts
        │
        ▼
Privacy/Legal assessment: confirmed breach? whose data? what categories? risk to individuals?
        │
        ├─► Notify CUSTOMERS (we are the Processor):
        │     DPA §5.7 — "without undue delay, and in any case within 72 hours" of awareness,
        │     with the information reasonably available (nature, categories/approx. counts,
        │     likely consequences, measures taken). Send a follow-up as facts firm up.
        │
        ├─► Regulators are generally the CUSTOMER's (Controller's) obligation. We ASSIST per
        │     DPA §5.6 (GDPR Arts. 32–36). For ScrollPop's OWN controller data (e.g. employee/
        │     account data), Legal assesses direct obligations:
        │       • GDPR/UK GDPR — supervisory authority within 72h if risk to individuals.
        │       • Japan APPI — report to the PPC and notify affected individuals where required
        │         (esp. sensitive data or ≥1,000 individuals); first-party data is Tokyo-resident.
        │       • US state laws / CCPA — notify per applicable state breach-notification statutes.
        │
        └─► Affected individuals — only on Customer instruction (Processor role), unless ScrollPop
              is the Controller for that data set.
```

**Notification content (minimum):** what happened and when; categories and approximate number of
records/data subjects; likely consequences; measures taken/proposed to mitigate; and a contact point
(`privacy@scrollpop.online`). Use a holding notice if facts are still developing — do not wait for a
complete picture to make the first contact within 72 hours.

**Channels:** customer notification via account email + (if material) status page; regulator/legal
via counsel. Pre-drafted templates live with the Comms Lead.

---

## 7. Key contacts & escalation

| Need | Contact |
|---|---|
| Declare an incident / page IC | [on-call channel / phone tree] |
| Security inbox (external reports) | security@scrollpop.online |
| Privacy / breach-notification | privacy@scrollpop.online + [external counsel] |
| Fly.io / Cloudflare / Upstash / Clerk / Stripe support | [provider support links + account IDs] |
| Cyber-insurance carrier (if held) | [carrier + policy #] |

> **TODO before audit:** fill every `[bracketed]` contact above and store an off-platform copy
> (the plan must be reachable when the platform itself is the incident).

---

## 8. Testing & evidence

- **Tabletop exercise** at least **annually** (walk a Sev-1 scenario end-to-end — e.g. "a Clerk
  secret leaked in a public gist"). Record attendees, scenario, findings → evidence for the auditor.
- Every real incident's post-mortem + timeline is retained as evidence of the control operating.
- The **Jun-12 DB-OOM outage** ([`incident-db-oom-jun12`](../MASTER.md)) is a worked availability
  example — back-fill it into this format as the first reference post-mortem.

---

## 9. Related documents

- [`soc2-control-mapping.md`](soc2-control-mapping.md) — TSC → control mapping (CC7.3–7.5).
- [`soc2-readiness-checklist.md`](soc2-readiness-checklist.md) — policy set, owners, backup/restore.
- [`security-logging-alerting-proposal.md`](security-logging-alerting-proposal.md) — CC7.2 detection.
- [`risk-register.md`](risk-register.md) — where corrective actions are tracked.
- [`dpa.md`](dpa.md) — §5.6/§5.7 obligations, Annex III sub-processors.
