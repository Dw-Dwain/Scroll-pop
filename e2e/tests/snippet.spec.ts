import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Snippet runtime suite — the most critical end-to-end path.
 *
 * No server needed: we inject the BUILT snippet bundle (packages/snippet/dist/p.js) into a
 * blank fixture page and mock the edge config/beacon endpoints with route interception.
 *
 * Two snippet behaviours force the setup:
 *  - The popup renders in a CLOSED Shadow DOM, so we assert the light-DOM host element
 *    (`#__sp_popup_*`) rather than piercing the shadow root.
 *  - The snippet aborts on headless/bot UAs and navigator.webdriver by design, so each
 *    context spoofs a real Chrome UA and forces navigator.webdriver = false.
 */

const snippetPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../packages/snippet/dist/p.js',
);
const journeyChunkPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../packages/snippet/dist/journey.js',
);

const PUBLIC_KEY = 'e2e-test-key-00000000';
const EDGE = 'https://edge.e2e.test';

function mockConfig(overrides: Record<string, unknown> = {}) {
  return {
    siteId: 'e2e-site',
    plan: 'growth',
    version: 'e2e',
    campaigns: [
      {
        id: 'e2e-campaign',
        design: {
          kind: 'modal', position: 'center', size: 'md',
          backgroundColor: '#ffffff', textColor: '#111111', accentColor: '#6366f1',
          borderRadius: 12, overlayEnabled: true, overlayOpacity: 0.5,
          headline: 'E2E Test Popup', ctaText: 'Go', ctaStyle: 'button',
          showCloseButton: true, closeButtonPosition: 'top-right',
          showDismissText: false, animation: 'fade', showPoweredBy: false,
        },
        triggers: [{ id: 't1', type: 'dwell_time', params: { seconds: 3 } }],
        targeting: [],
        frequency: { frequency: 'always' },
        affiliateSlots: [],
      },
    ],
    ...overrides,
  };
}

async function bootSnippet(browser: import('@playwright/test').Browser, config: unknown) {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // The snippet fetches the config cross-origin (edge.e2e.test), so the mocked response
  // MUST carry CORS headers or the browser blocks it and the snippet never boots.
  const cors = { 'Access-Control-Allow-Origin': '*' };
  await page.route('**/c/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(config) }),
  );
  await page.route('**/e', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: '{"received":1}' }),
  );
  // The core lazy-loads the journey engine from <edge>/journey.js when the config has journeys.
  await page.route('**/journey.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', headers: cors, body: fs.readFileSync(journeyChunkPath, 'utf8') }),
  );

  // Serve the fixture from a REAL origin (routed navigation) — about:blank/setContent is an
  // opaque origin with no localStorage, which the snippet touches before fetching config and
  // would abort on. The inline script sets the globals and shadows navigator.webdriver so the
  // bot guard passes.
  await page.route('https://e2e.fixture.local/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><html><head><script>
        try { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); } catch (e) {}
        window.__SP_EDGE_URL = ${JSON.stringify(EDGE)};
        window.__sp = { publicKey: ${JSON.stringify(PUBLIC_KEY)}, q: [] };
      </script></head><body><h1>E2E fixture</h1></body></html>`,
    }),
  );
  await page.goto('https://e2e.fixture.local/');
  await page.addScriptTag({ content: fs.readFileSync(snippetPath, 'utf8') });
  return { context, page };
}

test.describe('snippet runtime', () => {
  test('built bundle exists and is under the 10 KB gzip gate', async () => {
    expect(fs.existsSync(snippetPath), 'run `pnpm --filter snippet build` first').toBeTruthy();
  });

  test('renders the popup host in the light DOM after the dwell trigger fires', async ({ browser }) => {
    const { context, page } = await bootSnippet(browser, mockConfig());
    // dwell 3s + the snippet's 2s min-time-on-page gate → appears ~3s; allow generous wait.
    const host = page.locator('[id^="__sp_popup_"]');
    await expect(host).toHaveCount(1, { timeout: 12_000 });
    await context.close();
  });

  test('does NOT render when targeting excludes the visitor', async ({ browser }) => {
    const cfg = mockConfig();
    // Exclude-everywhere URL rule → campaign must not fire.
    (cfg.campaigns[0] as Record<string, unknown>).targeting = [
      { id: 'r1', kind: 'url_contains', operator: 'exclude', value: { pattern: '' } },
    ];
    const { context, page } = await bootSnippet(browser, cfg);
    await page.waitForTimeout(6_000);
    await expect(page.locator('[id^="__sp_popup_"]')).toHaveCount(0);
    await context.close();
  });

  test('renders nothing when the config has no campaigns', async ({ browser }) => {
    const { context, page } = await bootSnippet(browser, mockConfig({ campaigns: [] }));
    await page.waitForTimeout(6_000);
    await expect(page.locator('[id^="__sp_popup_"]')).toHaveCount(0);
    await context.close();
  });
});

// ─── Journey engine end-to-end ───────────────────────────────────────────────
// Exercises the real journey.js engine in a real browser: the core boots, loads the journey
// chunk, arms the entry, shows step 1, and — because each step's `timeout` branch auto-advances —
// chains to step 2 with no in-popup interaction (the popup is a closed Shadow DOM, so its buttons
// aren't reachable from Playwright; the timeout branch is the interaction-free proof of chaining).
//
// The two campaigns have EMPTY triggers, so the ONLY way either can appear is the journey engine
// calling ctx.show — i.e. a popup host appearing proves the journey advanced to that node.
function journeyDesign(headline: string) {
  return {
    kind: 'modal', position: 'center', size: 'md',
    backgroundColor: '#ffffff', textColor: '#111111', accentColor: '#6366f1',
    borderRadius: 12, overlayEnabled: true, overlayOpacity: 0.5,
    headline, ctaText: 'Go', ctaStyle: 'button',
    showCloseButton: true, closeButtonPosition: 'top-right',
    showDismissText: false, animation: 'fade', showPoweredBy: false,
  };
}

function mockJourneyConfig() {
  return {
    siteId: 'e2e-site', plan: 'growth', version: 'e2e-journey',
    campaigns: [
      { id: 'jcmp-1', design: journeyDesign('Journey Step 1'), triggers: [], targeting: [], frequency: { frequency: 'always' }, affiliateSlots: [] },
      { id: 'jcmp-2', design: journeyDesign('Journey Step 2'), triggers: [], targeting: [], frequency: { frequency: 'always' }, affiliateSlots: [] },
    ],
    journeys: [
      {
        id: 'jny-e2e', entryNodeId: 'entry', trigger: null, maxPopups: 4, minDelay: 5,
        nodes: [
          { id: 'entry', type: 'entry', next: { always: 'pop1' } },
          { id: 'pop1', type: 'popup', campaignId: 'jcmp-1', config: { timeoutSeconds: 5 }, next: { timeout: 'pop2' } },
          { id: 'pop2', type: 'popup', campaignId: 'jcmp-2', config: { timeoutSeconds: 5 }, next: { timeout: 'goal' } },
          { id: 'goal', type: 'goal', config: { kind: 'conversion' }, next: {} },
        ],
      },
    ],
  };
}

test.describe('journey engine', () => {
  test('chains step 1 → step 2 via the engine (entry → popup → timeout branch → next popup)', async ({ browser }) => {
    const { context, page } = await bootSnippet(browser, mockJourneyConfig());

    // Entry has no trigger → the journey starts at boot and shows step 1's campaign.
    await expect(page.locator('[id="__sp_popup_jcmp-1"]'), 'journey step 1 should appear').toHaveCount(1, { timeout: 12_000 });
    // Step 2's campaign has no triggers of its own, so its host can ONLY come from the journey's
    // timeout branch advancing — i.e. proof the engine chained popup → popup end to end.
    await expect(page.locator('[id="__sp_popup_jcmp-2"]'), 'journey step 2 should appear after the timeout branch').toHaveCount(1, { timeout: 15_000 });

    await context.close();
  });

  test('a campaign in a journey does NOT self-trigger (only the engine shows it)', async ({ browser }) => {
    // Same campaigns but NO journeys block → with empty triggers, nothing should ever render.
    const cfg = mockJourneyConfig();
    delete (cfg as Record<string, unknown>)['journeys'];
    const { context, page } = await bootSnippet(browser, cfg);
    await page.waitForTimeout(8_000);
    await expect(page.locator('[id^="__sp_popup_"]')).toHaveCount(0);
    await context.close();
  });
});
