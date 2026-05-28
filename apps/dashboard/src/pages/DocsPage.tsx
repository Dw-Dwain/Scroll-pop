import React from 'react';
import { ArrowLeft, BookOpen, Code2, Zap, Globe, Layers, Shield } from 'lucide-react';

interface DocsPageProps { onNavigate: (path: string) => void; }

const SECTIONS = [
  {
    icon: Zap,
    title: 'Quick Start',
    desc: 'Add the ScrollPop snippet to any site in under 2 minutes.',
    items: ['Install via CDN or npm', 'Paste your site public key', 'Publish your first campaign'],
  },
  {
    icon: Globe,
    title: 'Site Integration',
    desc: 'WordPress, Shopify, raw HTML — all platforms supported.',
    items: ['WordPress plugin setup', 'Shopify theme app embed', 'Manual HTML snippet'],
  },
  {
    icon: Layers,
    title: 'Campaign Builder',
    desc: 'Design scroll-triggered popups with the visual canvas editor.',
    items: ['Popup types & triggers', 'A/B variant testing', 'Affiliate slot configuration'],
  },
  {
    icon: Shield,
    title: 'Targeting & Rules',
    desc: 'Show the right popup to the right visitor at the right time.',
    items: ['URL pattern matching', 'Geo & device targeting', 'UTM & referrer conditions'],
  },
  {
    icon: Code2,
    title: 'API Reference',
    desc: 'Full REST API for custom integrations and automations.',
    items: ['Authentication & JWT tokens', 'Campaign endpoints', 'Event & analytics API'],
  },
];

export const DocsPage: React.FC<DocsPageProps> = ({ onNavigate }) => (
  <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 0 60px' }}>
    <button
      onClick={() => onNavigate('/dashboard')}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', padding: '0 0 28px', fontFamily: 'var(--font-sans)' }}
    >
      <ArrowLeft size={14} /> Back to Dashboard
    </button>

    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <BookOpen size={22} style={{ color: 'var(--accent-500)' }} />
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Documentation</h1>
    </div>
    <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 40, fontFamily: 'var(--font-sans)' }}>
      Everything you need to install, configure, and scale ScrollPop campaigns.
    </p>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
      {SECTIONS.map(({ icon: Icon, title, desc, items }) => (
        <div key={title} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--accent-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={16} style={{ color: 'var(--accent-500)' }} />
            </div>
            <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>{desc}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map(item => (
              <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent-500)', flexShrink: 0 }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </div>
);
