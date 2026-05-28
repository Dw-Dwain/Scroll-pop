import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';

interface TermsPageProps { onNavigate: (path: string) => void; }

const SECTIONS = [
  { title: '1. Acceptance of Terms', body: "By accessing or using the ScrollPop platform, you agree to be bound by these Terms of Service. If you do not agree, do not use the service. These terms apply to all users, operators, and organizations on the platform." },
  { title: '2. Permitted Use', body: "You may use ScrollPop to create and deploy scroll-triggered popup campaigns on sites you own or have authorization to modify. You may not use ScrollPop to deliver spam, malware, deceptive advertising, or content that violates Google's webmaster guidelines." },
  { title: '3. Google Policy Compliance', body: "ScrollPop is explicitly designed to comply with Google's spam policies. The snippet does not manipulate browser history, intercept back-button navigation, or use window.onbeforeunload for navigation interception. Any campaign that violates these policies is prohibited and may result in account termination." },
  { title: '4. Prohibited Content', body: "You may not use ScrollPop for campaigns promoting illegal goods or services, adult content, misleading health claims, phishing, or any content that misrepresents the popup as a native browser dialog." },
  { title: '5. Billing & Refunds', body: "Subscriptions are billed monthly or annually. Usage overages are billed at the start of the following billing cycle. Refunds are available within 14 days of initial subscription only. Downgrading mid-cycle credits the difference to your next invoice." },
  { title: '6. Service Availability', body: "ScrollPop targets 99.9% monthly uptime for the API and edge delivery layer. Scheduled maintenance is announced 48 hours in advance. We are not liable for losses resulting from downtime beyond our SLA." },
  { title: '7. Termination', body: "We reserve the right to suspend or terminate accounts that violate these terms, generate abusive API traffic, or engage in fraudulent billing. You may cancel your account at any time from the Settings page." },
];

export const TermsPage: React.FC<TermsPageProps> = ({ onNavigate }) => (
  <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 0 60px' }}>
    <button
      onClick={() => onNavigate('/dashboard')}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', padding: '0 0 28px', fontFamily: 'var(--font-sans)' }}
    >
      <ArrowLeft size={14} /> Back to Dashboard
    </button>

    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
      <FileText size={22} style={{ color: 'var(--accent-500)' }} />
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Terms of Service</h1>
    </div>
    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 36, fontFamily: 'var(--font-sans)' }}>Last updated: May 2026</p>

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
