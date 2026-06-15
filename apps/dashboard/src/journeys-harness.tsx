// ─────────────────────────────────────────────────────────────────────────────
// Auth-free local harness for the Journeys node editor.
//
// The real /journeys page is gated behind Clerk + the API, which can't initialize
// in a headless preview browser (the dev Clerk key is bound to the owner's own
// browser session). This harness mounts the REAL <JourneyEditor> with window.fetch
// stubbed (sample graph + 2 test campaigns), inside a faithful copy of the Layout
// content-wrapper chain — so the `.page-enter > div` CSS context is reproduced and
// the editor's full-width fix can be verified visually.
//
// Toggle the buggy vs fixed wrapper with ?bug=1 in the URL.
// ─────────────────────────────────────────────────────────────────────────────
/* eslint-disable react-refresh/only-export-components -- standalone Vite entry point, not a fast-refresh module */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import { JourneyEditor } from './pages/Journeys';
import './index.css';

// ── Mock the API the editor calls via authedFetch → window.fetch ────────────────
const SAMPLE_GRAPH = {
  id: 'jny_demo', name: 'Demo Journey', description: null, siteId: 'site_1',
  status: 'draft', startsAt: null, endsAt: null, version: 1,
  nodes: [
    { id: 'n_entry', type: 'entry', campaignId: null, config: { trigger: { type: 'scroll_pct', params: { pct: 50 } } }, posX: 80,  posY: 40 },
    { id: 'n_pop1',  type: 'popup', campaignId: 'cmp_1', config: {}, posX: 80,  posY: 180 },
    { id: 'n_pop2',  type: 'popup', campaignId: 'cmp_2', config: {}, posX: 80,  posY: 320 },
    // Reuses cmp_1 — the SAME campaign as n_pop1 — so the funnel proves per-NODE attribution
    // (step 1 and step 3 show different counts, not one merged campaign row).
    { id: 'n_pop3',  type: 'popup', campaignId: 'cmp_1', config: {}, posX: 80,  posY: 460 },
    { id: 'n_goal',  type: 'goal',  campaignId: null, config: { kind: 'conversion' }, posX: 80,  posY: 600 },
  ],
  edges: [
    { id: 'e1', sourceNodeId: 'n_entry', targetNodeId: 'n_pop1', branch: 'always',  config: {} },
    { id: 'e2', sourceNodeId: 'n_pop1',  targetNodeId: 'n_pop2', branch: 'dismiss', config: {} },
    { id: 'e3', sourceNodeId: 'n_pop2',  targetNodeId: 'n_pop3', branch: 'dismiss', config: {} },
    { id: 'e4', sourceNodeId: 'n_pop3',  targetNodeId: 'n_goal', branch: 'convert', config: {} },
  ],
};

// Per-step funnel mock (GET /journeys/:id/diagnose) — the 21 → 12 → 2 drop-off, with cmp_1 reused
// as step 1 (21) and step 3 (2) to demonstrate node-level (not campaign-level) attribution.
const SAMPLE_FUNNEL = {
  journeyId: 'jny_demo', windowDays: 30,
  totals: { impressions: 35, views: 30, clicks: 11, conversions: 5, dismissals: 15 },
  nodes: [
    { nodeId: 'n_pop1', campaignId: 'cmp_1', campaignName: 'Welcome 50% Off',     order: 0, impressions: 21, views: 18, clicks: 6, conversions: 3, dismissals: 9, ctr: 0.2857, cvr: 0.1429, viewRate: 0.8571, stepRetention: null },
    { nodeId: 'n_pop2', campaignId: 'cmp_2', campaignName: 'Exit-Intent Voucher', order: 1, impressions: 12, views: 10, clicks: 4, conversions: 2, dismissals: 5, ctr: 0.3333, cvr: 0.1667, viewRate: 0.8333, stepRetention: 0.5714 },
    { nodeId: 'n_pop3', campaignId: 'cmp_1', campaignName: 'Welcome 50% Off',     order: 2, impressions: 2,  views: 2,  clicks: 1, conversions: 0, dismissals: 1, ctr: 0.5,    cvr: 0,      viewRate: 1,      stepRetention: 0.1667 },
  ],
};

const CAMPAIGNS = [
  // cmp_1 has its own triggers → selecting the popup node that uses it shows the "triggers ignored
  // inside a journey" hint. cmp_2 has none → no hint (clean contrast for visual verification).
  { id: 'cmp_1', name: 'Welcome 50% Off', status: 'active', siteId: 'site_1', triggerCount: 2 },
  { id: 'cmp_2', name: 'Exit-Intent Voucher', status: 'active', siteId: 'site_1', triggerCount: 0 },
];

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (/\/journeys\/[^/]+\/diagnose$/.test(url)) return json({ data: SAMPLE_FUNNEL });
  if (/\/journeys\/[^/]+$/.test(url) && (!init || (init.method ?? 'GET') === 'GET')) return json({ data: SAMPLE_GRAPH });
  if (/\/journeys\/[^/]+\/graph$/.test(url)) return json({ data: { ok: true } });
  if (/\/journeys\/[^/]+\/publish$/.test(url)) return json({ data: { ok: true } });
  return realFetch(input as RequestInfo, init);
}) as typeof window.fetch;

// ── Faithful replica of the Layout content-wrapper chain ───────────────────────
// Mirrors apps/dashboard/src/components/Layout.tsx for an isSplitPage route.
const bug = new URLSearchParams(location.search).has('bug');

const Harness: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#0a0a0a' }}>
    {/* topnav placeholder (48px) */}
    <div style={{ height: 48, flexShrink: 0, background: '#0a0a0a', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', padding: '0 16px', color: '#fff', fontSize: 13, fontWeight: 700 }}>
      ScrollPop — Journeys harness {bug ? '(BUG: page-enter)' : '(FIXED: split-page, no page-enter)'}
    </div>
    <main style={{ flex: 1, overflowY: 'hidden', background: 'transparent', display: 'flex', flexDirection: 'column' }}>
      {/* The wrapper under test. isSplitPage=true → with the fix, className is '' (not 'page-enter'). */}
      <div
        className={bug ? 'page-enter' : ''}
        style={{ flex: 1, padding: '0', width: '100%', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
      >
        <ReactFlowProvider>
          <JourneyEditor journeyId="jny_demo" campaigns={CAMPAIGNS} meta={{ maxPopups: 4, minDelaySeconds: 5 }} onClose={() => { /* noop */ }} />
        </ReactFlowProvider>
      </div>
    </main>
  </div>
);

createRoot(document.getElementById('root')!).render(<React.StrictMode><Harness /></React.StrictMode>);
