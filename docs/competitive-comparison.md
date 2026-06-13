# ScrollPop — Competitive Comparison

> **Status:** Internal comparison reference (not public-facing). Last updated: 2026-06-13.
> Scope: a like-for-like comparison of ScrollPop against the popup / conversion-overlay vendors we
> most directly compete with in the US and Japan, plus **Promolayer** (our closest cross-market
> benchmark). Competitor certification/feature claims are as **self-published** by each vendor and
> were fact-checked against primary sources where possible; treat them as marketing until a current
> report is sighted. Where a claim could not be verified it is marked *unverified*.
>
> Keep this internal: it names competitors and characterizes their compliance posture. Do not paste
> into the public trust page or the DPA.

---

## Summary table

| Vendor | Market | Security / certs (self-published) | Consent / compliance features | Google June-2026 back-button policy |
|---|---|---|---|---|
| **ScrollPop** | US + JP | Closed Shadow DOM, sanitizer-first rendering, Postgres RLS (live), CI security gates, AES-256-GCM secret encryption. **No SOC 2 / ISO 27001 / Privacy Mark yet.** | GPC + Google Consent Mode v2; built-in consent banner; WCAG 2.1 accessible dialogs; DPA drafted. | **Compliant by design** — history APIs banned and enforced in CI. |
| **Promolayer** | Global / JP | No SOC 2 / ISO 27001 / Privacy Mark published (states "GDPR-compliant by default"). *Cert posture otherwise unverified.* | Markets GDPR-compliant defaults. | Advertises **back-button detection (戻るボタン検出)** — a technique that **appears to conflict** with the policy; sites using it may risk ranking penalties. |
| **Justuno** | US | Claims **SOC 2 Type II** (recertified 2023) + public trust portal (trust.justuno.com). | Built-in **GDPR/CCPA cookie-consent banners** with templates, geo-targeting, consent renewal. | No public position sighted. *Unverified.* |
| **OptinMonster** | US | No SOC 2 / ISO / CCPA tooling claimed on its GDPR page. | Publishes a **DPA** + GDPR audit concierge. | No public position sighted. *Unverified.* |
| **OptiMonk / Privy / Wisepops** | US | Cert posture **unverified** (no SOC 2/ISO claim surfaced in this pass). | GDPR/CCPA features marketed to varying degrees; Shopify-native. | No public position sighted. *Unverified.* |
| **KARTE (Plaid Inc.)** | Japan | **ISO 27001 (2015), Privacy Mark / Pマーク (2015), ISO 27017** cloud-security. | Enterprise web-接客 (web customer-service) platform. | No public position sighted. *Unverified.* |
| **Repro** | Japan | **ISO 27001 / ISMS (2018)** — obtained because enterprise clients required it. | Web/app engagement + CRO. | No public position sighted. *Unverified.* |

---

## By dimension

### 1. Security (engineering)
ScrollPop is **at or above** the field on disclosed technical controls: a *closed* Shadow DOM (most
competitors inject into the host page), a sanitizer-first render path with tests, row-level
multi-tenant isolation live in production, and CI-enforced guardrails. The gap is **not** the
controls — it is that competitors make their posture **auditable** via certifications (below), which
we do not yet.

### 2. Compliance & certifications — the real gap
- **US bar:** Justuno publishes SOC 2 Type II + a trust portal. SOC 2 Type II is effectively a
  market requirement for mid-market/enterprise B2B SaaS.
- **Japan bar:** KARTE and Repro hold ISO 27001 (KARTE also Privacy Mark). In Japanese enterprise
  procurement these are hard table-stakes — an uncertified vendor is screened out before evaluation.
- **Promolayer:** like ScrollPop, publishes **no** SOC 2 / ISO / Privacy Mark — so on certifications
  we are at parity with our closest benchmark, and ahead of it on the Google-policy dimension.
- **ScrollPop:** holds none yet — the single biggest blocker to enterprise + Japan. (See
  `soc2-control-mapping.md` for the readiness plan.)

### 3. Google June-2026 back-button policy — ScrollPop's structural edge
ScrollPop never manipulates browser history (banned and CI-enforced), so it is compliant by
construction ahead of the 15 June 2026 enforcement date. Promolayer advertises **back-button
detection**, which **appears to conflict** with the policy — a concrete differentiator we can lead
with. (Phrased as "appears to" deliberately: characterizing a competitor's compliance should stay
hedged unless independently confirmed.)

### 4. Ease of use / build
Broadly competitive: 91 templates, drag-and-drop builder, ~12 KB performance-budgeted snippet,
edge delivery, A/B + journey engine, production-ready WordPress plugin. Gaps vs. the field: Shopify
integration still maturing (Privy/OptiMonk/Justuno are deeply Shopify-native), and 6 builder
elements unfinished. Japanese web-接客 tools (KARTE) lean heavily on rich social-proof elements.

---

## Takeaways
1. **Certifications are the gap, not the engineering.** Pursue SOC 2 Type II (US) + ISO 27001 /
   Privacy Mark (Japan). Against Promolayer specifically we are already at cert-parity.
2. **Lead with the Google-policy and accessibility advantages** — both are real, both are things
   competitors (incl. Promolayer) do not clearly have.
3. **Treat all competitor claims as self-reported** until a current report is sighted; keep the
   Promolayer back-button characterization hedged in anything that leaves the building.
