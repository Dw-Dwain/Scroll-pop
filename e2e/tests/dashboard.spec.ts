import { test, expect } from '@playwright/test';

/**
 * Dashboard smoke suite — runs against the local dev server in DEMO mode
 * (VITE_DEMO_MODE=true): no Clerk, no real DB. Asserts the shell renders and the
 * primary routes load without crashing into an error boundary.
 */

const BASE = 'http://localhost:5173';

test.describe('dashboard (demo mode)', () => {
  test('shell renders with primary nav', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // Primary sidebar nav items present (Layout) — stable, always-visible labels.
    await expect(page.getByText('Dashboard', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Campaigns', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Analytics', { exact: true }).first()).toBeVisible();
  });

  for (const path of ['/campaigns', '/analytics', '/sites', '/settings', '/billing']) {
    test(`route ${path} loads without crashing`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
      // Body has rendered content and no uncaught page error fired.
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('#root')).not.toBeEmpty();
      expect(errors, `uncaught errors on ${path}: ${errors.join(' | ')}`).toEqual([]);
    });
  }

  test('campaigns page shows a create affordance', async ({ page }) => {
    await page.goto(`${BASE}/campaigns`, { waitUntil: 'domcontentloaded' });
    // A "new/create campaign" control should exist (button or link).
    const create = page.getByRole('button', { name: /new|create/i })
      .or(page.getByRole('link', { name: /new|create/i }));
    await expect(create.first()).toBeVisible();
  });
});
