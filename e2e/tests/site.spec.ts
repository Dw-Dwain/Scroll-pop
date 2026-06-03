import { test, expect } from '@playwright/test';

/**
 * Marketing site smoke suite — fully static, runs against the local dev server.
 */

const BASE = 'http://localhost:3000';

test.describe('marketing site', () => {
  test('home renders hero + brand + primary CTA', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('ScrollPop').first()).toBeVisible();
    await expect(page.getByText(/Start Free/i).first()).toBeVisible();
    expect(errors, `uncaught errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('comparison section is present', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('How we compare').first()).toBeVisible();
  });

  test('pricing navigation works', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /pricing/i }).or(page.getByRole('link', { name: /pricing/i })).first().click();
    // Pricing view shows tier pricing.
    await expect(page.getByText(/\$0|Free/i).first()).toBeVisible();
  });

  test('no console errors on load', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500); // let any deferred app errors surface
    // Allow benign third-party noise but fail on app-level errors.
    const appErrors = consoleErrors.filter((t) => !/favicon|analytics|posthog/i.test(t));
    expect(appErrors, appErrors.join(' | ')).toEqual([]);
  });
});
