# ScrollPop Data Processing Agreement (DPA)

> ⚠️ **DRAFT TEMPLATE — NOT LEGAL ADVICE.** This is a starting template modeled on standard
> processor DPAs (cf. OptinMonster's published DPA). It **must** be reviewed and adapted by
> qualified privacy counsel before being offered to customers. The sub-processor list, regions, and
> cross-border bases (§6, §8) are filled from the current (post-Tokyo-migration) infrastructure; the
> remaining bracketed `[...]` items are the **legal-entity name** (§ preamble) and counsel-decision
> notes flagged inline. Do not represent this as executed or counsel-approved until it is.
> Last updated: 2026-06-17.

This Data Processing Agreement ("DPA") forms part of the Agreement between **[ScrollPop legal entity
name]** ("ScrollPop", "Processor") and the customer ("Customer", "Controller") for the provision of
the ScrollPop popup/overlay platform (the "Service"). It reflects the parties' agreement on the
Processing of Personal Data.

In the event of a conflict between this DPA and the Agreement, this DPA controls with respect to the
Processing of Personal Data.

---

## 1. Definitions

- **"Applicable Data Protection Laws"** means all laws applicable to the Processing of Personal Data
  under the Agreement, including, as applicable, the EU GDPR, UK GDPR, the California Consumer
  Privacy Act as amended by the CPRA ("CCPA"), and Japan's Act on the Protection of Personal
  Information ("APPI").
- **"Controller", "Processor", "Data Subject", "Personal Data", "Processing"** have the meanings
  given in the GDPR (and equivalent terms under other Applicable Data Protection Laws — e.g.
  "Business" and "Service Provider" under the CCPA).
- **"End Visitor"** means an individual who visits a website operated by Customer on which the
  Service is deployed.
- **"Sub-processor"** means any third party engaged by ScrollPop to Process Personal Data.

---

## 2. Roles of the parties

2.1 With respect to End Visitor Personal Data collected via the Service, **Customer is the
Controller** (CCPA: "Business") and **ScrollPop is the Processor** (CCPA: "Service Provider").

2.2 ScrollPop shall Process Personal Data only on documented instructions from Customer, including
as set out in the Agreement and this DPA, unless required by law (in which case ScrollPop will
inform Customer unless legally prohibited).

2.3 **CCPA service-provider commitment.** ScrollPop shall not: (a) sell or share Personal Data;
(b) retain, use, or disclose Personal Data for any purpose other than performing the Service or as
permitted by the CCPA; or (c) combine Personal Data with data from other sources except as permitted
by the CCPA. ScrollPop certifies it understands and will comply with these restrictions.

---

## 3. Subject-matter and details of Processing

(Annex I)

- **Subject matter:** Provision of the ScrollPop popup/overlay and analytics Service.
- **Duration:** For the term of the Agreement, plus the retention/deletion period in §9.
- **Nature and purpose:** Displaying popups; capturing leads submitted by End Visitors; recording
  popup interaction events for analytics and conversion measurement.
- **Categories of Data Subjects:** End Visitors of Customer's websites; Customer's authorized users.
- **Categories of Personal Data:**
  - End Visitors: online identifiers (visitor/session IDs), IP-derived approximate country, device
    and browser metadata, page URLs, interaction events, and any data the End Visitor voluntarily
    submits via a popup form (e.g. email address, name).
  - Customer users: account identity managed by our authentication provider.
- **Special-category data:** None intended or requested. Customer shall not configure popups to
  collect special-category/sensitive Personal Data.
- **Frequency:** Continuous, for the duration of the Service.

---

## 4. Customer obligations

4.1 Customer warrants it has a valid legal basis and all necessary notices/consents to collect and
Process End Visitor Personal Data through the Service, including any cookie/tracking consent required
under the GDPR/ePrivacy, CCPA, and APPI.

4.2 Customer is responsible for configuring the Service's consent controls (GPC handling, consent
mode, strict opt-in) consistent with its legal obligations.

---

## 5. ScrollPop (Processor) obligations

ScrollPop shall:

5.1 Process Personal Data only per Customer's documented instructions (§2.2).

5.2 Ensure persons authorized to Process Personal Data are bound by confidentiality.

5.3 Implement and maintain the technical and organizational security measures in **Annex II**.

5.4 Respect the conditions for engaging Sub-processors in §6.

5.5 Taking into account the nature of Processing, assist Customer by appropriate technical and
organizational measures, insofar as possible, in fulfilling Customer's obligation to respond to Data
Subject requests (§7).

5.6 Assist Customer in ensuring compliance with security, breach-notification, data-protection-
impact-assessment, and prior-consultation obligations (Articles 32–36 GDPR), taking into account the
information available to ScrollPop.

5.7 Notify Customer **without undue delay and in any case within 72 hours** after becoming aware of
a Personal Data Breach, with the information reasonably available.

5.8 At Customer's choice, delete or return Personal Data at the end of the Service (§9).

5.9 Make available information necessary to demonstrate compliance and allow for and contribute to
audits, subject to §10.

---

## 6. Sub-processors

6.1 Customer provides **general authorization** for ScrollPop to engage Sub-processors. The current
list is maintained in `docs/trust-and-security.md` §2 and in Annex III below (to be published at
`trust.scrollpop.online/sub-processors` before general availability).

6.2 ScrollPop shall notify Customer of intended changes (addition/replacement) at least **30 days**
in advance, giving Customer the opportunity to object on reasonable data-protection grounds.

6.3 ScrollPop shall impose data-protection obligations on Sub-processors no less protective than this
DPA and remains liable for their performance.

**Current Sub-processors (Annex III — verify provider posture before publishing):**

End Visitor Personal Data collected via the Service is processed and stored primarily in **Japan**
(Fly.io Tokyo region + Upstash Tokyo). The US-based Sub-processors below primarily handle Customer
account, billing, transactional-email, and product-analytics data, plus error telemetry; Cloudflare
serves edge delivery globally. Cross-border transfers are addressed in §8.

| Sub-processor (entity) | Purpose | Data location | Cross-border transfer basis |
|---|---|---|---|
| **Fly.io** (Fly.io, Inc., US) | API hosting + managed PostgreSQL (primary datastore) | Tokyo, Japan (`nrt`) | Primary data resident in Japan. EEA/UK data: EU SCCs + UK Addendum, Fly.io as importer. |
| **Cloudflare** (Cloudflare, Inc., US) | Edge delivery (Workers), R2 object storage, KV cache | Global edge (PoP nearest the visitor) | EU SCCs + UK Addendum; confirm provider DPF certification. APPI: see §8.2. |
| **Upstash** (Upstash, Inc., US) | Redis — rate-limit counters, event-ingest buffer | Tokyo, Japan (`ap-northeast-1`) | Transient buffer in Japan. EEA/UK data: EU SCCs + UK Addendum. |
| **Clerk** (Clerk, Inc., US) | Authentication & org management (Customer users) | United States | EU SCCs + UK Addendum. APPI: see §8.2. |
| **Stripe** (Stripe, Inc., US) | Billing (no card data stored by ScrollPop) | United States (global) | EU SCCs + UK Addendum; confirm provider DPF certification. APPI: see §8.2. |
| **Sentry** (Functional Software, Inc., US) | Error monitoring | United States | EU SCCs + UK Addendum. APPI: see §8.2. |
| **PostHog** (PostHog, Inc., US) | Product analytics (dashboard usage) | United States (US Cloud) | EU SCCs + UK Addendum. APPI: see §8.2. |
| **Resend** (Resend, Inc., US) | Transactional email | United States | EU SCCs + UK Addendum. APPI: see §8.2. |

---

## 7. Data Subject requests

7.1 ScrollPop shall, to the extent legally permitted, promptly notify Customer of any request
received directly from a Data Subject and shall not respond except on Customer's instructions.

7.2 ScrollPop shall provide self-service and/or assisted tooling to enable Customer to access,
correct, delete, or export End Visitor Personal Data to fulfill access/deletion/portability requests.

---

## 8. International data transfers

8.1 Where Processing involves a transfer of Personal Data out of the EEA/UK, the parties agree the
applicable **Standard Contractual Clauses** (and the UK Addendum, where relevant) are incorporated by
reference, with ScrollPop as data importer.

8.2 **Japan (APPI).** ScrollPop's primary datastore and event-ingest buffer are located in Japan
(Fly.io Tokyo region; Upstash `ap-northeast-1`), so End Visitor Personal Data collected via the
Service is processed and stored in Japan. Certain Sub-processors located outside Japan may receive
Personal Data: Cloudflare (global edge delivery) and — for Customer account, billing, transactional-
email, product-analytics, and error-telemetry data — Clerk, Stripe, Resend, PostHog, and Sentry
(all United States). For such cross-border transfers, ScrollPop relies on APPI Article 28 measures,
namely binding contractual commitments (the applicable Sub-processor DPAs) requiring the recipient
to maintain protections substantially equivalent to APPI standards, together with the provision of
required information to Data Subjects. [Counsel to confirm whether End Visitor consent (obtained via
the Service's consent banner) is additionally required or relied upon, and to finalize the
per-recipient mechanism — contractual equivalent-protection vs. consent vs. adequacy.]

---

## 9. Retention and deletion

9.1 ScrollPop uses soft-deletion with retention windows to guard against accidental loss. On
termination, ScrollPop shall delete or return Personal Data within **30 days**, except where
retention is required by law.

9.2 Analytics/event data is retained for **13 months** and then deleted or irreversibly
anonymized/aggregated.

---

## 10. Audits

10.1 ScrollPop shall make available a summary of its security posture and, when available, its
SOC 2 Type II report and/or ISO 27001 certificate under NDA, to satisfy audit obligations.

10.2 To the extent the above is insufficient, Customer may conduct an audit on **reasonable prior
written notice, no more than once per 12 months**, during business hours, without unreasonably
disrupting ScrollPop's operations, subject to confidentiality.

---

## 11. Liability and term

This DPA is subject to the liability provisions of the Agreement. This DPA takes effect on the
Agreement's effective date and terminates with it.

---

### Annex II — Technical and Organizational Measures (summary)

- Closed Shadow DOM rendering; sanitizer-first output encoding; no `eval`/`document.write`.
- PostgreSQL Row-Level Security on tenant-scoped tables + application-layer tenant filtering.
- Encryption in transit (TLS 1.2+, HSTS); encryption at rest via providers; AES-256-GCM for stored
  third-party credentials.
- Managed authentication (Clerk), least-privilege database roles, secrets via secret stores.
- Rate limiting and per-(campaign, IP) flood protection on unauthenticated ingest.
- CI security gates: no-history-manipulation, snippet size budget, migration safety, lint/typecheck,
  security regression tests.
- Restrictive HTTP security headers and CSP.
- [Add: logging/monitoring, access reviews, MFA, vulnerability management, incident response,
  business continuity — to be completed alongside SOC 2.]

---

*Signature blocks, governing law, and notices to be added by counsel.*
