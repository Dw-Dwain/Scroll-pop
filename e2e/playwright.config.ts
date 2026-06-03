import { defineConfig, devices } from '@playwright/test';

/**
 * ScrollPop E2E — runs against LOCAL dev servers only (no staging env exists, and prod
 * uses live Clerk auth + a live DB, so we never point E2E at production).
 *
 *  - Marketing site runs as-is (fully static).
 *  - The snippet suite needs no server — it injects the built bundle into a fixture page
 *    and mocks the edge config/beacon endpoints with Playwright route interception.
 *
 * The dashboard is intentionally NOT covered here: it now requires real Clerk auth + a live
 * DB (the demo/no-auth showcase build was removed Jun 2026), which E2E deliberately avoids.
 *
 * CI: a non-gating `e2e` job runs this headless. It does NOT block deploys (kept out of
 * the deploy `needs` list) so E2E flake can never wedge a release.
 */
export default defineConfig({
  testDir: './tests',
  // Serialized: the dashboard/site run on Vite DEV servers that compile modules on first
  // request. Parallel workers all hitting a cold server at once causes a thundering-herd
  // first-compile that blows navigation timeouts. One worker pays the compile cost once,
  // then every subsequent navigation is warm. The suite is small, so wall-time is fine.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    trace: 'on-first-retry',
    // A realistic desktop Chrome UA — the snippet aborts on headless/bot UAs by design,
    // so the snippet suite overrides this per-context anyway (see snippet.spec.ts).
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Boot the marketing site for the UI suite. (The snippet suite needs no server.)
  webServer: [
    {
      command: 'pnpm --filter react-example dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
