# ScrollPop — Risk Register (SOC 2 CC3 / CC9)

> **Purpose:** A living register of identified risks, their treatment, and owners — the artifact an
> auditor expects for **CC3 (risk assessment)** and **CC9.1 (risk mitigation)**. This is seeded from
> real, known items (incidents, the June-2026 security review, the control mapping). It is **not** a
> placeholder — review and re-score quarterly, and add new risks as they surface (e.g. from incident
> post-mortems and the SCA pipeline).
> **Owner:** [Security Lead]. **Last reviewed:** 2026-06-22. **Cadence:** quarterly + after any Sev-1/2.

## Scoring

Likelihood (L) × Impact (I), each 1–5 → score 1–25.
- **Treatment:** Mitigate / Accept / Transfer / Avoid.
- **Status:** Open / In progress / Mitigated / Accepted (with named approver).

| ID | Risk | Category | L | I | Score | Treatment & current controls | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| R-01 | **Leaked GitHub PATs in git history** not yet revoked (flagged in the Jun-17 remediation). A live token in history can be cloned and replayed. | Access / secrets | 3 | 5 | **15** | Mitigate: revoke all PATs present in history; rotate; enable push protection / secret scanning; confirm no token still grants access. | [Owner] | **Open — action required** |
| R-02 | **No tested backup/restore or DR drill.** Managed Postgres has PITR/backups, but restore has never been exercised; RPO/RTO undefined. | Availability (A1.2/A1.3) | 3 | 5 | **15** | Mitigate: define RPO/RTO, run a restore drill into a scratch DB, verify RLS intact post-restore, document. See readiness checklist. | [Eng Lead] | Open |
| R-03 | **MFA enforcement not yet evidenced** across all admin/prod consoles (available via Clerk, not proven org-enforced everywhere). | Access (CC6) | 2 | 5 | **10** | Mitigate: complete [`mfa-enforcement.md`](mfa-enforcement.md) §3 with evidence; re-verify quarterly. | [Security Lead] | In progress |
| R-04 | **Fragmented security monitoring** (no central log/alert beyond Sentry errors). Slows detection; weak CC7.2 evidence. | Detection (CC7.2) | 3 | 3 | **9** | Mitigate: implement [`security-logging-alerting-proposal.md`](security-logging-alerting-proposal.md) (phased). | [Security Lead] | Open |
| R-05 | **DB-OOM outage class** (Jun-12: `scrollpop-db` Postgres OOM on 256 MB). Recurrence risk if memory/capacity not monitored. | Availability (A1.1) | 2 | 4 | **8** | Mitigate: DB memory raised; CI self-heals stopped Fly machines; **add capacity/memory alerting** and a documented capacity policy. | [Eng Lead] | In progress |
| R-06 | **Stored XSS via tenant-controlled design fields** rendered by the on-site snippet onto customer sites (design fields are outside the Zod schema). | App security (CC6.6) | 2 | 5 | **10** | Mitigate (strong): closed Shadow DOM + mandatory sanitizers (`packages/snippet/src/sanitize.ts`) with unit tests; CI keeps them green. Residual risk = a new render path bypassing a sanitizer. Keep `sanitize.test.ts` green; review new render code. | [Eng Lead] | Mitigated (monitor) |
| R-07 | **Affiliate X-close-redirect** carries affiliate-program ToS risk (single-click redirect on popup close). | Compliance / business | 3 | 3 | **9** | **Accept** — owner-mandated business decision (isolated into a lazy chunk + KV kill-switch + audit logging; Novatise-gated). Do not re-litigate. | [Owner/Founder] | **Accepted (Founder)** |
| R-08 | **Cross-border transfer basis** for US/EU sub-processors (Sentry/PostHog/etc.) under APPI/GDPR not finalized by counsel. | Privacy / legal | 3 | 4 | **12** | Mitigate: first-party data is Tokyo-resident; SCCs/DPF + APPI mechanism to be finalized by counsel (DPA §8, trust portal §6). | [Legal] | Open |
| R-09 | **Vendor/sub-processor concentration** (Fly, Cloudflare, Upstash, Clerk, Stripe, Sentry, PostHog, Resend). Sub-processor breach or outage cascades to us. | Vendor (CC9.2) | 2 | 4 | **8** | Mitigate: all are SOC 2 Type II (trust portal §2); formalize a vendor risk-review + re-verify certs annually. | [Security Lead] | Open |
| R-10 | **Key-person / small-team risk:** limited separation of duties; bus factor on deploys, DB, and security. | Governance (CC1) | 3 | 3 | **9** | Mitigate: document runbooks, ensure ≥2 people can perform critical ops, CODEOWNERS + branch protection enforce review. | [Founder] | Open |
| R-11 | **No CODEOWNERS** at repo root — review-ownership of security-sensitive paths (snippet, RLS, CI gates, auth) is not codified. | Change mgmt (CC8/CC1.5) | 2 | 3 | **6** | Mitigate: add root `CODEOWNERS` for `packages/snippet/**`, `apps/api/src/db/**`, `.github/workflows/**`, auth/tenant-context; enable "require review from code owners" in branch protection. | [Eng Lead] | Open |
| R-12 | **Dev-only HIGH dependency advisory** (esbuild <0.28.1 via drizzle-kit `@esbuild-kit` migration tooling). Not in the customer runtime. | Vuln mgmt (CC6.8) | 2 | 2 | **4** | **Accept (low):** dev/migration-only; CI `--prod` gate ensures it can't reach runtime; Dependabot will bump when upstream allows. Reported, non-blocking. | [Eng Lead] | Accepted |
| R-13 | **No SOC 2 / ISO 27001 certification held** — top blocker for enterprise + Japan deals. | Business / compliance | 4 | 4 | **16** | Mitigate: this whole readiness program — platform + observation window + pentest + audit. | [Founder/Security Lead] | In progress |

## How this register is used

- Re-scored each **quarterly risk assessment** (CC3.2); new risks added from incidents, the SCA
  pipeline, pentest findings, and vendor reviews.
- Corrective actions from incident post-mortems land here with owners + due dates
  ([incident-response plan](incident-response-plan.md) §5.5).
- High-scoring open items (≥12) are reviewed at each leadership sync until mitigated or formally
  accepted by a named approver.

## Related
- [`soc2-control-mapping.md`](soc2-control-mapping.md) · [`soc2-readiness-checklist.md`](soc2-readiness-checklist.md) · [`incident-response-plan.md`](incident-response-plan.md)
