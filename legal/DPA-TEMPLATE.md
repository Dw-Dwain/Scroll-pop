<!--
  ScrollPop — Data Processing Agreement (DPA) TEMPLATE
  ====================================================
  ⚠️  ENGINEERING DRAFT — NOT LEGAL ADVICE.
  This is a working template to send to customers who request a DPA. It MUST be
  reviewed and approved by a qualified attorney before it is offered or signed.
  Fill in every [BRACKETED] field. Delete this comment block before sending.

  Last reviewed by counsel: ____________________  (fill in)
  Template version: 0.1-draft · 2026-06-02
-->

# Data Processing Agreement

This Data Processing Agreement ("**DPA**") forms part of the Agreement for the
provision of the ScrollPop services ("**Services**") between:

- **[CUSTOMER LEGAL NAME]**, [registered address] ("**Customer**" / "**Controller**"); and
- **[YOUR LEGAL ENTITY NAME]**, [registered address] ("**ScrollPop**" / "**Processor**"),

each a "**Party**" and together the "**Parties**".

This DPA reflects the Parties' agreement on the processing of Personal Data in
accordance with the requirements of Applicable Data Protection Laws, including the
EU General Data Protection Regulation 2016/679 ("**GDPR**"), the UK GDPR, and the
California Consumer Privacy Act as amended ("**CCPA/CPRA**"), to the extent applicable.

If there is any conflict between this DPA and the Agreement, this DPA controls with
respect to the processing of Personal Data.

---

## 1. Definitions

Capitalised terms not defined here have the meaning given in the Agreement or
Applicable Data Protection Laws.

- **Applicable Data Protection Laws** — all laws and regulations applicable to the
  processing of Personal Data under the Agreement, including GDPR, UK GDPR, and
  CCPA/CPRA.
- **Controller**, **Processor**, **Data Subject**, **Personal Data**, **Processing**,
  **Personal Data Breach** — as defined in the GDPR.
- **Sub-processor** — any third party engaged by ScrollPop to process Personal Data
  on Customer's behalf.
- **Standard Contractual Clauses ("SCCs")** — the clauses approved by the European
  Commission (Decision 2021/914) and, for UK transfers, the UK International Data
  Transfer Addendum.

---

## 2. Roles of the Parties

For the purposes of this DPA:

- **Customer is the Controller** of the Personal Data processed through the Services.
- **ScrollPop is the Processor**, processing Personal Data only on Customer's
  documented instructions.

Where Customer is itself a processor acting on behalf of a third-party controller,
ScrollPop acts as a sub-processor, and Customer warrants it has the authority to
engage ScrollPop on those terms.

---

## 3. Subject Matter, Duration, Nature and Purpose

- **Subject matter:** ScrollPop's processing of Personal Data to provide the Services
  (scroll-triggered popup/overlay campaigns, affiliate slot delivery, and aggregated
  campaign analytics).
- **Duration:** for the term of the Agreement, plus the retention/deletion periods in
  Section 11.
- **Nature and purpose:** collection, storage, structuring, and analysis of website
  visitor interaction events for the purpose of delivering and measuring Customer's
  popup campaigns.

Full processing details are in **Annex I**.

---

## 4. Customer Instructions

ScrollPop shall process Personal Data only:

1. on Customer's documented instructions, including as set out in the Agreement, this
   DPA, and Customer's configuration of the Services; and
2. as required by applicable law, in which case ScrollPop shall (where legally
   permitted) inform Customer of that legal requirement before processing.

ScrollPop shall promptly inform Customer if, in its opinion, an instruction infringes
Applicable Data Protection Laws.

---

## 5. Confidentiality

ScrollPop ensures that personnel authorised to process Personal Data are bound by
appropriate confidentiality obligations and are trained on their data-protection
responsibilities. Access is limited to personnel who need it to provide the Services.

---

## 6. Security Measures

ScrollPop implements appropriate technical and organisational measures to protect
Personal Data against accidental or unlawful destruction, loss, alteration,
unauthorised disclosure, or access, as described in **Annex II**, including (without
limitation):

- Encryption of data **in transit** (TLS) across all service endpoints.
- **Tenant isolation** enforced at the database layer via PostgreSQL Row-Level
  Security on every tenant-scoped table, plus application-layer tenant filtering
  (defence in depth).
- Popups rendered inside a **closed Shadow DOM**, isolating them from the host page.
- Secrets held exclusively in environment variables, never in source code.
- The visitor snippet stores only a first-party, anonymous identifier and honours
  Do-Not-Track and host-site consent signals; visitor IP is read at the edge to
  derive an approximate country and is **not stored**.

ScrollPop may update its security measures from time to time provided the updates do
not materially reduce the overall level of protection.

---

## 7. Sub-processors

7.1 Customer provides **general authorisation** for ScrollPop to engage the
Sub-processors listed in **Annex III** to process Personal Data.

7.2 ScrollPop shall impose data-protection obligations on each Sub-processor that are
no less protective than those in this DPA, and remains liable for each
Sub-processor's performance.

7.3 ScrollPop shall give Customer **at least [30] days' prior notice** of any intended
addition or replacement of a Sub-processor (by [email to the Customer's nominated
contact / update to a public sub-processor page]), during which Customer may object on
reasonable data-protection grounds. If the Parties cannot resolve the objection,
Customer may terminate the affected Services.

---

## 8. International Transfers

Where processing involves a transfer of Personal Data from the EEA, UK, or
Switzerland to a country without an adequacy decision, the Parties agree that the
**Standard Contractual Clauses** (and UK Addendum, where applicable) are incorporated
by reference and apply to that transfer.

> **Data residency note (accurate as of this template version):** ScrollPop's primary
> database is hosted in the **Asia-Pacific (Singapore, `ap-southeast-1`)** region.
> Sub-processors (Annex III) operate globally. ScrollPop does **not** currently
> guarantee EU-only data residency. Customers with strict EU-residency requirements
> should contact [legal/sales contact] before relying on the Services; do not
> represent EU-only residency to Data Subjects unless and until it is contractually
> confirmed in writing.

---

## 9. Assistance to the Controller

Taking into account the nature of the processing, ScrollPop shall assist Customer,
by appropriate technical and organisational measures and insofar as possible, in:

- responding to **Data Subject requests** (access, rectification, erasure,
  restriction, portability, objection);
- ensuring compliance with security obligations (Art. 32 GDPR);
- carrying out **data protection impact assessments** (Art. 35) and prior
  consultation (Art. 36) where required.

---

## 10. Personal Data Breach Notification

ScrollPop shall notify Customer **without undue delay, and in any event within [72]
hours**, after becoming aware of a Personal Data Breach affecting Customer's Personal
Data. The notification shall include, to the extent known: the nature of the breach,
the categories and approximate number of Data Subjects and records affected, the
likely consequences, and the measures taken or proposed. ScrollPop shall provide
reasonable cooperation to assist Customer in meeting its own notification obligations.

---

## 11. Return and Deletion

Upon termination or expiry of the Agreement, ScrollPop shall, at Customer's choice,
delete or return all Personal Data processed on Customer's behalf, and delete existing
copies, within **[30/60/90] days**, unless retention is required by applicable law.
ScrollPop uses soft-deletion during the active term; hard-deletion on termination is
subject to backup-rotation cycles not exceeding **[35] days**.

---

## 12. Audit

ScrollPop shall make available to Customer information reasonably necessary to
demonstrate compliance with this DPA and allow for and contribute to audits,
including inspections, conducted by Customer or an auditor mandated by Customer,
**no more than once per 12 months** unless required by a supervisory authority, on
reasonable prior written notice and subject to confidentiality. ScrollPop may satisfy
audit requests by providing third-party certifications or reports where available.

---

## 13. Liability; Governing Law

The liability of each Party under this DPA is subject to the limitations and
exclusions of liability set out in the Agreement. This DPA is governed by the laws of
**[GOVERNING JURISDICTION]**, and the courts of **[JURISDICTION]** have exclusive
jurisdiction, without prejudice to the SCCs' own governing-law provisions.

---

## 14. Term

This DPA takes effect on the date last signed below and remains in force for the
duration of ScrollPop's processing of Personal Data under the Agreement.

---

## Signatures

| Customer (Controller) | ScrollPop (Processor) |
|---|---|
| Name: __________________ | Name: __________________ |
| Title: _________________ | Title: _________________ |
| Date: __________________ | Date: __________________ |
| Signature: _____________ | Signature: _____________ |

---

## Annex I — Details of Processing

| Item | Detail |
|---|---|
| **Categories of Data Subjects** | Visitors to Customer's website(s) where the ScrollPop snippet is installed; Customer's own authorised users (account holders). |
| **Categories of Personal Data** | Anonymous visitor identifier (random, first-party); session identifier; device type (mobile/desktop); page URL and referrer; approximate country (derived from IP at the edge, IP **not stored**); interaction events (impression, view, click, dismiss, conversion). Where Customer configures email/lead-capture popups: **email addresses and any data the visitor submits**. Account users: name, email, organisation. |
| **Special categories** | None requested or required. Customer must not configure the Services to collect special-category data. |
| **Frequency** | Continuous, for the term of the Agreement. |
| **Processing operations** | Collection, transmission, storage, aggregation, analysis, display. |
| **Retention** | Event data retained for the active term; deleted/returned per Section 11. |

---

## Annex II — Technical and Organisational Measures

- TLS encryption for all data in transit.
- PostgreSQL Row-Level Security on every tenant-scoped table; application-layer
  tenant filtering (defence in depth).
- Closed Shadow DOM isolation for all rendered popups.
- Authentication and session management via Clerk (passwords never stored by
  ScrollPop); MFA available.
- Rate limiting and DDoS/WAF protection at the Cloudflare edge.
- Secrets stored only in environment variables.
- Least-privilege access controls and confidentiality obligations for personnel.
- Honouring of Do-Not-Track and host-site consent signals; optional strict
  per-tenant opt-in consent mode.

---

## Annex III — Authorised Sub-processors

> Keep this list in sync with the public sub-processor disclosure
> (`site-plan/src/components/LegalView.tsx`).

| Sub-processor | Purpose | Data processed | Primary region |
|---|---|---|---|
| **Clerk** | Authentication & user management | Account email, identity, session | [US / global] |
| **Stripe** | Payment processing | Billing data, card data (PCI-DSS; card numbers never stored by ScrollPop) | [US / global] |
| **Cloudflare** | Edge delivery (CDN, Workers, KV, R2) | Snippet requests, event ingest, IP (transient, for geo) | Global edge |
| **Neon** | Postgres database hosting | Campaign data, analytics events, account data | Asia-Pacific (`ap-southeast-1`) |
| **Render** | API hosting | Event data in transit before storage | [US / region] |
| **Upstash** | Redis (rate limiting, event buffering) | Transient counters & event buffer; no persistent personal data | [region] |

<!--
  Reviewer checklist before this template goes live:
  [ ] Attorney has reviewed and approved the full text.
  [ ] All [BRACKETED] fields filled (entity names, addresses, notice periods,
      retention windows, governing law).
  [ ] Annex III regions confirmed against each sub-processor's current contract.
  [ ] Security page (LegalView.tsx) data-residency claim reconciled — it currently
      says "Frankfurt (EU)" which is INACCURATE; DB is in ap-southeast-1.
  [ ] Decide sub-processor change-notice mechanism (email vs public page) and reflect
      in Section 7.3 and the public privacy page.
-->
