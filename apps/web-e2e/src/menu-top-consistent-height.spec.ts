import { test, expect } from '@playwright/test';
import { LayoutPage } from './pages/layout.page';

/**
 * MenuTop — Consistent Height
 *
 * Verifies the menu bar has a stable, integer-pixel height and publishes
 * --menu-top-height as a rounded value. This prevents the resize handle
 * from shifting by 1px when panel trigger icons appear or disappear.
 */

test.describe('MenuTop consistent height', () => {
  test.use({
    extraHTTPHeaders: {
      Cookie: 'HYPHA_ENABLE_HUMAN_CHAT=true; HYPHA_ENABLE_AI_CHAT=true',
    },
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'HYPHA_ENABLE_HUMAN_CHAT',
        value: 'true',
        domain: '127.0.0.1',
        path: '/',
      },
      {
        name: 'HYPHA_ENABLE_AI_CHAT',
        value: 'true',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
  });

  test('--menu-top-height CSS variable should be set and integer on space page', async ({
    page,
  }) => {
    await page.goto('/en/dho/hypha/agreements');
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
    // Must be a whole number — no fractional pixels
    expect(value.trim()).toBe(`${px}px`);
  });

  test('menu bar height should be integer pixels (no subpixel drift)', async ({
    page,
  }) => {
    await page.goto('/en/dho/hypha/agreements');
    await page.waitForLoadState('domcontentloaded');

    // Poll until --menu-top-height is set by ResizeObserver
    await page.waitForFunction(
      () =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--menu-top-height')
          .trim() !== '',
      { timeout: 5000 },
    );

    // Read the published CSS variable
    const cssValue = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--menu-top-height')
        .trim(),
    );
    const cssHeight = parseInt(cssValue, 10);

    // Measure actual header bounding box via shared page object
    const layout = new LayoutPage(page);
    const menuTopBox = await layout.menuTop.boundingBox();
    const headerHeight = menuTopBox?.height ?? 0;

    expect(headerHeight).toBeGreaterThan(0);
    // CSS variable and actual height should match (within rounding)
    expect(cssHeight).toBe(Math.round(headerHeight));
  });
});
