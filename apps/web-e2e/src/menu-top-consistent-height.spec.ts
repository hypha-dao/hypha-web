import { test, expect } from '@playwright/test';

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
    await page.waitForTimeout(500);

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
    await page.waitForTimeout(500);

    // Read the published CSS variable
    const cssValue = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--menu-top-height')
        .trim(),
    );
    const cssHeight = parseInt(cssValue, 10);

    // Measure actual header bounding box
    // The menu bar is inside a sticky wrapper > header
    const headers = page.locator('header');
    const count = await headers.count();

    // Find the MenuTop header (contains bg-background-2 class)
    let headerHeight = 0;
    for (let i = 0; i < count; i++) {
      const box = await headers.nth(i).boundingBox();
      if (box && box.y === 0) {
        headerHeight = box.height;
        break;
      }
    }

    expect(headerHeight).toBeGreaterThan(0);
    // CSS variable and actual height should match (within rounding)
    expect(cssHeight).toBe(Math.round(headerHeight));
  });
});
