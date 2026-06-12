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
    { id: 'n_delay', type: 'delay', campaignId: null, config: { seconds: 10 }, posX: 80,  posY: 320 },
    { id: 'n_pop2',  type: 'popup', campaignId: 'cmp_2', config: {}, posX: 320, posY: 320 },
    { id: 'n_goal',  type: 'goal',  campaignId: null, config: { kind: 'conversion' }, posX: 80,  posY: 460 },
  ],
  edges: [
    { id: 'e1', sourceNodeId: 'n_entry', targetNodeId: 'n_pop1',  branch: 'always',  config: {} },
    { id: 'e2', sourceNodeId: 'n_pop1',  targetNodeId: 'n_delay', branch: 'dismiss', config: {} },
    { id: 'e3', sourceNodeId: 'n_pop1',  targetNodeId: 'n_pop2',  branch: 'convert', config: {} },
    { id: 'e4', sourceNodeId: 'n_delay', targetNodeId: 'n_goal',  branch: 'always',  config: {} },
  ],
};

const CAMPAIGNS = [
  { id: 'cmp_1', name: 'Welcome 50% Off', status: 'active', siteId: 'site_1' },
  { id: 'cmp_2', name: 'Exit-Intent Voucher', status: 'active', siteId: 'site_1' },
];

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
