import { test, expect } from '@playwright/test';
import { gotoApp } from './utils/nav-url';

/**
 * Side Panels — Space Context Only
 *
 * Verifies that AI and Human Chat panel triggers and sidebars are ONLY
 * rendered within a space context (/[lang]/dho/[id]/...) and are absent
 * on non-space pages (network, my-spaces, profile).
 *
 * Uses two-layer cookie strategy for AI Chat:
 * - extraHTTPHeaders for SSR
 * - addCookies for client-side navigation
 */

const CHAT_TRIGGER = /open chat panel/i;
const AI_TRIGGER = /open hypha ai panel/i;

test.describe('Panels visible on space pages', () => {
  test.use({
    extraHTTPHeaders: {
      Cookie: 'HYPHA_ENABLE_AI_CHAT=true',
    },
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'HYPHA_ENABLE_AI_CHAT',
        value: 'true',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
  });

  test('should show Human Chat trigger on a space page', async ({ page }) => {
    await gotoApp(page, '/en/dho/hypha/agreements');
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('button', { name: CHAT_TRIGGER }),
    ).toBeVisible();
  });

  test('should show AI trigger on a space page', async ({ page }) => {
    await gotoApp(page, '/en/dho/hypha/agreements');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('button', { name: AI_TRIGGER })).toBeVisible();
  });
});

test.describe('Panels hidden on non-space pages', () => {
  test.use({
    extraHTTPHeaders: {
      Cookie: 'HYPHA_ENABLE_AI_CHAT=true',
    },
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'HYPHA_ENABLE_AI_CHAT',
        value: 'true',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
  });

  test('should NOT show Human Chat trigger on /network', async ({ page }) => {
    await gotoApp(page, '/en/network');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('button', { name: CHAT_TRIGGER })).toHaveCount(
      0,
    );
  });

  test('should NOT show AI trigger on /network', async ({ page }) => {
    await gotoApp(page, '/en/network');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('button', { name: AI_TRIGGER })).toHaveCount(0);
  });

  test('should NOT show Human Chat trigger on /my-spaces', async ({ page }) => {
    await gotoApp(page, '/en/my-spaces');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('button', { name: CHAT_TRIGGER })).toHaveCount(
      0,
    );
  });

  test('should NOT show AI trigger on /my-spaces', async ({ page }) => {
    await gotoApp(page, '/en/my-spaces');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('button', { name: AI_TRIGGER })).toHaveCount(0);
  });

  test('should NOT render sidebar markup on /network', async ({ page }) => {
    await gotoApp(page, '/en/network');
    await page.waitForLoadState('domcontentloaded');

    // No panel sidebars should be in the DOM on non-space pages
    const leftPanel = page.locator('[data-side="left"]');
    const rightPanel = page.locator('[data-side="right"]');
    await expect(leftPanel).toHaveCount(0);
    await expect(rightPanel).toHaveCount(0);
  });
});

test.describe('Panels appear after navigating into a space', () => {
  test.use({
    extraHTTPHeaders: {
      Cookie: 'HYPHA_ENABLE_AI_CHAT=true',
    },
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'HYPHA_ENABLE_AI_CHAT',
        value: 'true',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
  });

  test('triggers should appear when navigating from /network to a space', async ({
    page,
  }) => {
    // Start on a non-space page
    await gotoApp(page, '/en/network');
    await page.waitForLoadState('domcontentloaded');

    // Verify triggers are absent
    await expect(page.getByRole('button', { name: CHAT_TRIGGER })).toHaveCount(
      0,
    );

    // Navigate to a space page via client-side routing
    await page.locator('a[href*="/dho/hypha"]').first().click();
    await page.waitForURL('**/dho/hypha/**');
    await page.waitForLoadState('domcontentloaded');

    // Triggers should now be visible
    await expect(
      page.getByRole('button', { name: CHAT_TRIGGER }),
    ).toBeVisible();
  });
});
