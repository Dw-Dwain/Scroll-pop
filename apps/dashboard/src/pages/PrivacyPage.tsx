import React from 'react';
import { ArrowLeft, Shield } from 'lucide-react';

interface PrivacyPageProps { onNavigate: (path: string) => void; }

const SECTIONS = [
  { title: 'Data We Collect', body: "ScrollPop collects minimal data required to operate the service: account information (email, org name), site public keys, campaign configurations, and popup event metrics (impressions, clicks, dismissals) with device type, page URL, referrer, and an approximate country. A visitor's IP address is read at the edge to derive country and is not stored. We do not collect personally identifiable information from your end users unless you explicitly configure a form field (e.g. an email capture) in a campaign." },
  { title: 'How We Use Your Data', body: "Campaign and event data is used solely to provide the analytics and reporting features visible in your dashboard. We do not sell, trade, or share your data with third parties for marketing purposes." },
  { title: 'Data Storage & Security', body: "All data is stored on PostgreSQL (Neon) with row-level security policies enforcing tenant isolation. Event data flows through Cloudflare Workers and the Render API, buffered in Upstash Redis, before being persisted. All data in transit is encrypted via TLS 1.3. Sub-processors: Clerk, Stripe, Cloudflare, Neon, Render, Upstash (and Sentry when enabled). A Data Processing Agreement is available on request." },
  { title: 'Cookies & Tracking', body: "The ScrollPop snippet uses first-party localStorage (not a cookie) on your visitors' site to implement frequency capping and an anonymous visitor identifier. No third-party tracking cookies are set, and it renders inside a closed Shadow DOM. It honors the Global Privacy Control signal and a host-site consent signal (window.__sp_consent = false, or Google Consent Mode analytics_storage 'denied'), which disables analytics and the visitor identifier while still allowing popups to display. For visitors in the EEA and the UK, analytics and the persistent visitor identifier are off by default and activate only after the visitor explicitly grants consent." },
  { title: 'Data Retention', body: "Analytics event data (impressions, clicks, dismissals, conversions) is retained for 13 months on every plan, after which it is automatically and permanently purged. Campaign configurations and account data are retained for the lifetime of your account. Soft-deleted records are purged after 30 days." },
  { title: 'Your Rights', body: "You may export or delete all your data at any time from the Settings page. Tenant deletion triggers a cascading purge of all campaigns, events, and configurations within 72 hours." },
];

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onNavigate }) => (
  <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 0 60px' }}>
    <button
      onClick={() => onNavigate('/dashboard')}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', padding: '0 0 28px', fontFamily: 'var(--font-sans)' }}
    >
      <ArrowLeft size={14} /> Back to Dashboard
    </button>

    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
      <Shield size={22} style={{ color: 'var(--accent-500)' }} />
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Privacy Policy</h1>
    </div>
    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 36, fontFamily: 'var(--font-sans)' }}>Last updated: June 2026</p>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {SECTIONS.map(({ title, body }) => (
        <div key={title}>
          <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', margin: '0 0 8px' }}>{title}</h3>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0 }}>{body}</p>
        </div>
      ))}
    </div>
  </div>
);
