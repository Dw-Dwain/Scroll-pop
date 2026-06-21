# Centralized Security Logging & Alerting — Proposal (SOC 2 CC7.2)

> **Purpose:** Close the CC7.2 gap — "monitoring for anomalies" is currently **per-tool and
> fragmented** (Sentry for errors, ad-hoc rate-limit logs, the `admin_audit_log` table). SOC 2 (and
> good incident response) wants a **defined place security-relevant events are aggregated, retained,
> and alerted on.** This is a recommendation for review, not yet implemented.
> **Owner:** [Security Lead]. **Last updated:** 2026-06-21.

---

## 1. What we have today

| Signal | Source | Where it lands | Gap |
|---|---|---|---|
| Application errors / exceptions | Sentry (API, Worker, dashboard) | Sentry | Errors, not security events; no auth/access trail |
| Privileged admin actions | `admin_audit_log` table ([`apps/api/src/lib/audit.ts`](../apps/api/src/lib/audit.ts)) | Postgres (Tokyo) | Not alertable; queried manually; no anomaly detection |
| Rate-limit / `/e` flood gates | `apps/api/src/index.ts` | App logs (Fly) → stdout | Ephemeral; not aggregated or alerted |
| Auth events (login, MFA, new device) | Clerk | Clerk dashboard | Not pulled into our monitoring |
| Edge/WAF (blocks, DDoS, bot) | Cloudflare | Cloudflare dashboard | Siloed from app signals |
| Dependency / SAST findings | Dependabot, CI `dependency-scan`, `security-audit`, CodeQL | GitHub Security tab | Good — already centralized in GitHub |
| Platform/audit events | Fly.io, Cloudflare, GitHub audit logs | Each provider | No central collection or retention |

**Problem:** during an incident there is no single timeline; "was there unusual admin activity at
02:00?" requires logging into 4 consoles. There is no **alerting** on security events (only on errors,
via Sentry).

---

## 2. Design goals

1. **One queryable store** for security-relevant events with a **tamper-resistant, ≥1-year retention**
   (covers a 3–12 month Type II observation window + investigation lookback).
2. **Alerting** on a small, high-signal set of rules (below) routed to the on-call channel.
3. **Low operational burden** — a 2-person team should not run an ELK cluster. Prefer managed.
4. **Data residency aware** — first-party data is Tokyo-resident (APPI). Prefer a sink with an
   ap-northeast region or one that only receives metadata, not End-Visitor PII.
5. Cheap to start; no new always-on infrastructure if avoidable.

---

## 3. Options considered

| Option | Fit | Cost | Notes |
|---|---|---|---|
| **A. Better Stack (Logtail) / Axiom** — managed log aggregation + alerting | **Recommended to start** | $ low (gen-free tiers; usage-based) | Ship Fly + Worker logs via drain/HTTP; SQL-ish queries; built-in alert rules → Slack/email; minimal ops. Axiom has generous ingest and good retention economics. |
| **B. Grafana Cloud Loki + Alerting** | Strong | $ low–med | More setup; great if we later want metrics+logs+traces in one pane. |
| **C. Datadog Cloud SIEM / security monitoring** | Powerful, heavyweight | $$$ | Overkill at current stage; revisit upmarket. |
| **D. Cloudflare Logpush → R2 + scheduled queries** | Good for edge | $ low | We already run R2; cheap cold storage of edge logs. Pairs with A/B rather than replacing them. |
| **E. Self-hosted ELK/OpenSearch** | Flexible | $$ + heavy ops | Rejected — operational burden too high for the team size. |

**Recommendation:** **Option A (Axiom or Better Stack) as the central sink + alerting**, with
**Option D (Cloudflare Logpush → R2)** for cheap long-term edge-log retention. Revisit a full Cloud
SIEM (C) only when moving upmarket to enterprise where customers demand it.

---

## 4. What to send (and what NOT to)

**Send (security events):**
- App security events: auth failures, tenant-context denials, rate-limit/flood-gate trips, 4xx/5xx
  spikes on `/e` and admin routes, RLS errors.
- **`admin_audit_log` mirror** — stream each privileged action out as it's written (actor, action,
  target tenant, timestamp) so it's alertable and retained off-box.
- Clerk webhooks: new sign-in from new device, MFA disabled, role/owner changes, member added.
- Cloudflare: WAF blocks, rate-limit events, bot scores (via Logpush).
- Provider audit logs (Fly, GitHub, Cloudflare) pulled on a schedule.

**Do NOT send** End-Visitor PII or popup-form submissions to the log sink. Log **identifiers and
metadata, not payloads.** This keeps the sink out of APPI/GDPR data-residency scope and shrinks the
blast radius if the sink itself is compromised. Scrub IPs to /24 or country where feasible.

---

## 5. Initial alert rules (high-signal only — avoid fatigue)

| Alert | Condition | Severity | Route |
|---|---|---|---|
| Privileged action surge | > N `admin_audit_log` writes / 10 min, or any action by a non-admin actor | Sev-2 | on-call |
| MFA disabled / weakened | Clerk "2FA removed" or owner role granted | Sev-2 | on-call |
| Auth failure spike | login failures > threshold / 5 min for one account or IP | Sev-3 | channel |
| Ingest abuse | `/e` flood-gate trips above baseline sustained | Sev-3 | channel |
| RLS / tenant-context error | any tenant-isolation error in the API | Sev-1 | page |
| CI security gate red on `main` | `dependency-scan` / CodeQL / `no-history-manipulation` fails post-merge | Sev-2 | on-call |
| New CRITICAL advisory | weekly `security-audit` run fails | Sev-2 | on-call |

Every alert maps to a severity in the [incident-response plan](incident-response-plan.md) §3.

---

## 6. Phased rollout

1. **Phase 1 (≈1 day):** stand up the sink (Axiom/Better Stack), add a Fly log drain + Worker
   `console`-to-HTTP shipping for security events. Mirror `admin_audit_log` writes to it. Wire 3
   alerts: RLS error (page), MFA-disabled, CI gate red. — *gets us a real CC7.2 story fast.*
2. **Phase 2:** add Clerk webhooks + Cloudflare Logpush→R2; expand alert rules to the full §5 set;
   set retention ≥ 365 days.
3. **Phase 3:** schedule provider-audit-log pulls (GitHub/Fly/Cloudflare); add a weekly "security
   monitoring review" (CC4.1) where someone scans dashboards and signs off — itself audit evidence.

---

## 7. Evidence this produces for SOC 2

- A retained, queryable security-event store (control operates continuously).
- Alert configurations + a log of alerts that fired and how they were handled.
- The weekly monitoring-review sign-off (CC4.1) and the link from alerts → incidents (CC7.3/7.4).

---

## 8. Related

- [`incident-response-plan.md`](incident-response-plan.md) — detection sources + severities.
- [`soc2-control-mapping.md`](soc2-control-mapping.md) — CC7.2 row.
- [`soc2-readiness-checklist.md`](soc2-readiness-checklist.md) — monitoring-review cadence.
