import { test, expect } from '@playwright/test';
import { LayoutPage } from './pages/layout.page';
import { gotoApp } from './utils/nav-url';

/**
 * MenuTop — Consistent Height
 *
 * Verifies the menu bar has identical height on space pages (where panel
 * trigger icons are rendered) and non-space pages (where triggers are absent).
 * A 1px difference would cause the resize handle to misalign with the
 * content edge.
 */

test.describe('MenuTop consistent height', () => {
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

  test('header height should be identical on space and non-space pages', async ({
    page,
  }) => {
    // Use the sticky header that contains the logo — the MenuTop component
    const menuSelector = 'header.sticky';

    // Measure on a space page (trigger icons present)
    await gotoApp(page, '/en/dho/hypha/agreements');
    await page.waitForLoadState('domcontentloaded');
    const spaceHeader = page.locator(menuSelector).first();
    await spaceHeader.waitFor({ state: 'visible' });
    const spaceBox = await spaceHeader.boundingBox();
    expect(spaceBox).not.toBeNull();

    // Measure on a non-space page (no trigger icons)
    await gotoApp(page, '/en/network');
    await page.waitForLoadState('domcontentloaded');
    const networkHeader = page.locator(menuSelector).first();
    await networkHeader.waitFor({ state: 'visible' });
    const networkBox = await networkHeader.boundingBox();
    expect(networkBox).not.toBeNull();

    // Heights must be identical — no 1px drift allowed
    expect(spaceBox!.height).toBe(networkBox!.height);
  });

  test('--menu-top-height CSS variable should be set and integer', async ({
    page,
  }) => {
    await gotoApp(page, '/en/dho/hypha/agreements');
    await page.waitForLoadState('domcontentloaded');

    // Poll until --menu-top-height is set by ResizeObserver
    await page.waitForFunction(
      () =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--menu-top-height')
          .trim() !== '',
      { timeout: 5000 },
    );

    const value = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        '--menu-top-height',
      ),
    );
    expect(value).toBeTruthy();
    const px = parseInt(value, 10);
    expect(px).toBeGreaterThan(0);
    // Value should be an integer (no fractional pixels)
    expect(value.trim()).toBe(`${px}px`);
  });
});
