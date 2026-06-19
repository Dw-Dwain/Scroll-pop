import { ActivePage } from '../types';

interface LegalViewProps {
  page: 'privacy-policy' | 'terms' | 'security';
  onPageChange: (page: ActivePage) => void;
}

const LAST_UPDATED: Record<string, string> = {
  'privacy-policy': 'June 19, 2026',
  'terms': 'May 1, 2026',
  'security': 'June 19, 2026',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="font-serif text-xl font-normal text-neutral-900 mb-3">{title}</h2>
      <div className="text-sm text-neutral-600 font-light leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

function PrivacyPolicy() {
  return (
    <>
      <Section title="1. What We Collect">
        <p>When you create an account or use ScrollPop, we collect:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="font-medium text-neutral-800">Account data</strong> — name, email address, and organisation details provided during sign-up (managed by Clerk).</li>
          <li><strong className="font-medium text-neutral-800">Usage data</strong> — pages visited, features used, and in-app actions to help us improve the product.</li>
          <li><strong className="font-medium text-neutral-800">Campaign analytics</strong> — popup impressions, clicks, and conversion events fired from your sites. These events are associated with your tenant and stored in your Postgres database.</li>
          <li><strong className="font-medium text-neutral-800">Billing data</strong> — payment method and transaction history, processed by Stripe. We never store card numbers.</li>
          <li><strong className="font-medium text-neutral-800">Support communications</strong> — emails or messages you send to our team.</li>
        </ul>
      </Section>

      <Section title="2. How We Use Your Data">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>To provision, operate, and improve the ScrollPop service.</li>
          <li>To send transactional emails (account verification, billing receipts, plan change notifications).</li>
          <li>To calculate usage-based billing (popup view counts per billing period).</li>
          <li>To detect and prevent abuse, fraud, and security incidents.</li>
          <li>To respond to support requests.</li>
        </ul>
        <p>We do not sell your data. We do not use your visitors' data for advertising.</p>
      </Section>

      <Section title="3. Third-Party Services">
        <p>ScrollPop integrates with the following sub-processors:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="font-medium text-neutral-800">Clerk</strong> — authentication and user management. Processes email and identity data.</li>
          <li><strong className="font-medium text-neutral-800">Stripe</strong> — payment processing. Processes billing and card data under their PCI-DSS compliance.</li>
          <li><strong className="font-medium text-neutral-800">Cloudflare</strong> — edge delivery (CDN, Workers, KV, R2). Processes snippet requests and event ingest.</li>
          <li><strong className="font-medium text-neutral-800">Fly.io</strong> — API and managed Postgres database hosting (Tokyo / Japan region). Your campaign data and analytics are stored here, and event data is processed in transit before it is stored.</li>
          <li><strong className="font-medium text-neutral-800">Upstash</strong> — Redis for rate limiting and event buffering (Tokyo region). No personal data stored persistently.</li>
          <li><strong className="font-medium text-neutral-800">Sentry</strong> — error monitoring (when enabled). May include sanitised stack traces (IP-minimised).</li>
          <li><strong className="font-medium text-neutral-800">PostHog</strong> — product analytics for the ScrollPop dashboard (IP-minimised).</li>
          <li><strong className="font-medium text-neutral-800">Resend</strong> — transactional email (account, billing, and lead auto-responder messages).</li>
        </ul>
        <p>A Data Processing Agreement (DPA) is available to customers on request.</p>
      </Section>

      <Section title="4. Cookies">
        <p>ScrollPop sets no third-party tracking cookies on your visitors. The snippet uses first-party <code className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded">localStorage</code> on your own site for frequency-capping and an anonymous visitor identifier. A visitor's IP address is read at the edge (Cloudflare) to derive an approximate country and is <strong className="font-medium text-neutral-800">not stored</strong>. The snippet honours the Global Privacy Control signal and a host-site consent signal (<code className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded">window.__sp_consent = false</code> or Google Consent Mode <code className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded">analytics_storage: 'denied'</code>), which disables analytics and the visitor identifier while still allowing popups to display. For visitors in the EEA and the UK, analytics and the visitor identifier are off by default and activate only after the visitor explicitly grants consent.</p>
        <p>Our marketing site (scrollpop.online) may use functional cookies for session management. You can opt out via your browser settings.</p>
      </Section>

      <Section title="5. Data Retention">
        <p>Account data is retained for the duration of your subscription plus 90 days after cancellation, after which it is deleted. You may request immediate deletion at any time by emailing <a href="mailto:privacy@scrollpop.online" className="text-[#C05621] underline">privacy@scrollpop.online</a>.</p>
        <p>Analytics event data (impressions, clicks, conversions) is retained for 13 months on every plan, after which it is automatically and permanently purged. You can also purge it from the dashboard at any time under Settings → Data.</p>
      </Section>

      <Section title="6. GDPR & CCPA Rights">
        <p>If you are in the EU, EEA, UK, or California, you have the right to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Access a copy of the personal data we hold about you.</li>
          <li>Correct inaccurate data.</li>
          <li>Request deletion of your data ("right to be forgotten").</li>
          <li>Object to or restrict processing.</li>
          <li>Data portability (export in machine-readable format).</li>
          <li>Withdraw consent at any time where processing is consent-based.</li>
        </ul>
        <p>To exercise these rights, email <a href="mailto:privacy@scrollpop.online" className="text-[#C05621] underline">privacy@scrollpop.online</a>. We respond within 30 days.</p>
      </Section>

      <Section title="7. Contact">
        <p>Questions about this policy: <a href="mailto:privacy@scrollpop.online" className="text-[#C05621] underline">privacy@scrollpop.online</a></p>
      </Section>
    </>
  );
}

function TermsOfService() {
  return (
    <>
      <Section title="1. The Service">
        <p>ScrollPop ("we", "us") provides a SaaS platform for creating, deploying, and tracking scroll-triggered popup campaigns on websites. By creating an account you agree to these Terms.</p>
        <p>ScrollPop is operated by ScrollPop Ltd. We reserve the right to modify the service or these Terms at any time. Material changes will be notified by email with at least 14 days' notice.</p>
      </Section>

      <Section title="2. Account Responsibilities">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>You are responsible for maintaining the security of your account credentials.</li>
          <li>You must be 18 or older, or have legal capacity to enter a binding contract in your jurisdiction.</li>
          <li>Each account (organisation) may have multiple team members; you are responsible for their actions within the account.</li>
          <li>You must provide accurate billing and contact information and keep it up to date.</li>
        </ul>
      </Section>

      <Section title="3. Acceptable Use">
        <p>You may not use ScrollPop to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Deploy popups that manipulate browser history (<code className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded">history.pushState</code>, <code className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded">popstate</code> interception) — this violates Google's spam policies.</li>
          <li>Send spam or unsolicited commercial email via captured addresses without explicit consent.</li>
          <li>Collect sensitive personal data (passwords, payment cards, health data) through popup forms.</li>
          <li>Serve popups on sites you do not own or have explicit permission to operate on.</li>
          <li>Circumvent rate limits, tamper with the billing system, or reverse-engineer our APIs.</li>
          <li>Violate any applicable law, regulation, or third-party rights.</li>
        </ul>
        <p>We may suspend or terminate accounts in violation of these terms without prior notice.</p>
      </Section>

      <Section title="4. Billing & Payment">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Subscriptions are billed monthly or annually in advance via Stripe.</li>
          <li>Popup view overages above your plan limit result in automatic upgrade prompts; campaigns will pause (not error) when the limit is reached.</li>
          <li>Annual plans are non-refundable after 14 days. Monthly plans can be cancelled at any time; you retain access until the end of the billing period.</li>
          <li>We reserve the right to change pricing with 30 days' notice. Existing annual subscribers are not affected until renewal.</li>
        </ul>
      </Section>

      <Section title="5. Intellectual Property">
        <p>ScrollPop retains all rights to the platform, including the visual builder, snippet runtime, and dashboard. You retain ownership of your campaign designs and customer data.</p>
        <p>By using the service, you grant us a limited licence to process and store your content solely to provide the service.</p>
      </Section>

      <Section title="6. Limitation of Liability">
        <p>ScrollPop is provided "as is." To the fullest extent permitted by law, we exclude liability for indirect, incidental, or consequential damages, including lost revenue or data loss. Our total liability in any 12-month period is capped at the fees you paid us in that period.</p>
      </Section>

      <Section title="7. Governing Law">
        <p>These Terms are governed by the laws of England and Wales. Disputes shall be resolved in the courts of England and Wales, unless you are a consumer in a jurisdiction with mandatory local consumer-protection laws.</p>
      </Section>

      <Section title="8. Contact">
        <p>Legal enquiries: <a href="mailto:legal@scrollpop.online" className="text-[#C05621] underline">legal@scrollpop.online</a></p>
      </Section>
    </>
  );
}

function SecurityPage() {
  return (
    <>
      <Section title="Infrastructure Security">
        <p>ScrollPop is built on enterprise-grade infrastructure:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="font-medium text-neutral-800">Edge delivery</strong> — Cloudflare Workers serve the popup snippet from 300+ PoPs globally. DDoS protection and WAF are active on all edge endpoints.</li>
          <li><strong className="font-medium text-neutral-800">Database</strong> — managed Postgres hosted on Fly.io (Tokyo / Japan region) with Row-Level Security (RLS) policies on every tenant-scoped table. No query bypasses tenant isolation.</li>
          <li><strong className="font-medium text-neutral-800">API</strong> — Fastify backend deployed on Fly.io (Tokyo / Japan region). All external traffic is TLS 1.2+ only.</li>
          <li><strong className="font-medium text-neutral-800">Authentication</strong> — Clerk manages all identity and session tokens. We never store passwords. Multi-factor authentication is available on all plans.</li>
        </ul>
      </Section>

      <Section title="Data Encryption">
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="font-medium text-neutral-800">In transit</strong> — All data between your browser, our API, and our edge nodes is encrypted with TLS 1.3.</li>
          <li><strong className="font-medium text-neutral-800">At rest</strong> — Postgres data encrypted at rest (AES-256) by the managed hosting provider. R2 object storage encrypted at rest by default.</li>
          <li><strong className="font-medium text-neutral-800">Secrets</strong> — API keys, webhook secrets, and Stripe keys are stored in environment variables only — never in source code or database.</li>
        </ul>
      </Section>

      <Section title="Snippet Security">
        <p>The ScrollPop JavaScript snippet is designed to be safe to install on any website:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Renders entirely inside a <strong className="font-medium text-neutral-800">closed Shadow DOM</strong> — zero CSS leakage to your host page.</li>
          <li>No <code className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded">eval()</code>, <code className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded">document.write()</code>, or dynamic <code className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded">Function()</code> constructor.</li>
          <li>No <code className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded">history.pushState</code> or <code className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded">popstate</code> listeners — compliant with Google's June 2026 spam policy.</li>
          <li>Bundle size under <strong className="font-medium text-neutral-800">10 KB gzipped</strong>. Enforced by CI gate.</li>
          <li>Events beaconed via <code className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded">navigator.sendBeacon()</code> — fire-and-forget, no page blocking.</li>
        </ul>
      </Section>

      <Section title="Access Controls">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Role-based access: Owner, Admin, and Member roles within each organisation.</li>
          <li>All API endpoints require a valid Clerk JWT. Tenant context is enforced at the middleware layer on every request.</li>
          <li>Production database access is restricted to internal services only — no direct external connections.</li>
          <li>Internal tooling access uses SSO with mandatory MFA for all team members.</li>
        </ul>
      </Section>

      <Section title="Compliance">
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="font-medium text-neutral-800">GDPR</strong> — Data Processing Agreement available on request. First-party personal data is hosted in Japan (Tokyo); international transfers (e.g. to error-monitoring and analytics sub-processors) are covered by Standard Contractual Clauses and, for Japan, APPI cross-border safeguards.</li>
          <li><strong className="font-medium text-neutral-800">CCPA</strong> — We do not sell consumer personal information. Data Subject Request form available in dashboard.</li>
          <li><strong className="font-medium text-neutral-800">Global Privacy Control (GPC)</strong> — The snippet honors the browser-level GPC opt-out signal recognized under CCPA/CPRA: when a visitor's browser sends GPC, popups still render but no analytics events are recorded and no visitor ID is stored.</li>
          <li><strong className="font-medium text-neutral-800">PCI DSS</strong> — Payment data handled exclusively by Stripe (Level 1 PCI-DSS). We are out of scope for card data.</li>
        </ul>
      </Section>

      <Section title="Incident Response">
        <p>In the event of a confirmed security incident affecting customer data, we will:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Notify affected customers by email within 72 hours of confirmed breach (GDPR Article 33 compliant).</li>
          <li>Publish a public post-mortem within 14 days of resolution.</li>
          <li>Provide a dedicated incident status page at <span className="font-mono text-xs">status.scrollpop.online</span>.</li>
        </ul>
      </Section>

      <Section title="Vulnerability Disclosure">
        <p>If you discover a security vulnerability in ScrollPop, please report it responsibly to <a href="mailto:security@scrollpop.online" className="text-[#C05621] underline">security@scrollpop.online</a>. We aim to acknowledge reports within 24 hours and resolve critical issues within 7 days. We do not pursue legal action against good-faith security researchers.</p>
      </Section>
    </>
  );
}

const META: Record<string, { title: string; subtitle: string }> = {
  'privacy-policy': {
    title: 'Privacy Policy',
    subtitle: 'How we collect, use, and protect your data.',
  },
  'terms': {
    title: 'Terms of Service',
    subtitle: 'The rules and agreements governing your use of ScrollPop.',
  },
  'security': {
    title: 'Security',
    subtitle: 'How we protect your data and your visitors.',
  },
};

export default function LegalView({ page }: LegalViewProps) {
  const meta = META[page];

  return (
    <div className="max-w-3xl mx-auto px-6 py-20 font-sans text-neutral-800">
      <div className="mb-14">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#C05621] font-semibold block mb-3">LEGAL</span>
        <h1 className="font-serif text-4xl md:text-5xl font-normal tracking-tight leading-none text-neutral-900">
          {meta.title}
        </h1>
        <p className="text-neutral-500 font-light mt-3 text-base">{meta.subtitle}</p>
        <p className="text-[11px] font-mono text-neutral-400 mt-3 uppercase tracking-wider">
          Last updated: {LAST_UPDATED[page]}
        </p>
        <div className="mt-6 h-px bg-neutral-200" />
      </div>

      {page === 'privacy-policy' && <PrivacyPolicy />}
      {page === 'terms' && <TermsOfService />}
      {page === 'security' && <SecurityPage />}

      <div className="mt-16 pt-8 border-t border-neutral-200 text-xs font-mono text-neutral-400 uppercase tracking-wider">
        Questions? Email us at{' '}
        <a href="mailto:legal@scrollpop.online" className="text-[#C05621] underline lowercase">
          legal@scrollpop.online
        </a>
      </div>
    </div>
  );
}
