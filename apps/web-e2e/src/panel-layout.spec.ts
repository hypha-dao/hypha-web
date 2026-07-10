import { test, expect } from '@playwright/test';
import { LayoutPage } from './pages/layout.page';

test.describe('Panel Layout', () => {
  let layout: LayoutPage;

  test.use({
    extraHTTPHeaders: {
      Cookie: 'HYPHA_ENABLE_AI_CHAT=true',
    },
  });

  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'HYPHA_ENABLE_AI_CHAT',
        value: 'true',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
    await page.setViewportSize({ width: 1440, height: 900 });
    layout = new LayoutPage(page);
    await layout.open();
  });

  // ─── Requirement 1: Side panels do NOT scroll with the page ───

  test('left panel stays fixed when content scrolls', async ({ page }) => {
    await layout.openAiPanel();
    await expect(layout.leftSidebar).toBeVisible();
    const before = await layout.leftSidebar.boundingBox();
    expect(before).not.toBeNull();

    // Scroll the center content area
    await layout.centerInset.evaluate((el) => el.scrollBy(0, 500));
    await page.waitForTimeout(100);

    const after = await layout.leftSidebar.boundingBox();
    expect(after).not.toBeNull();
    expect(after!.y).toBe(before!.y);
  });

  test('right panel stays fixed when content scrolls', async ({ page }) => {
    await layout.openChatPanel();
    await expect(layout.rightSidebar).toBeVisible();
    const before = await layout.rightSidebar.boundingBox();
    expect(before).not.toBeNull();

    await layout.centerInset.evaluate((el) => el.scrollBy(0, 500));
    await page.waitForTimeout(100);

    const after = await layout.rightSidebar.boundingBox();
    expect(after).not.toBeNull();
    expect(after!.y).toBe(before!.y);
  });

  // ─── Requirement 2: Panel headers fixed top, content scrolls, input fixed bottom ───

  test('left panel: header pinned at top of panel', async () => {
    await layout.openAiPanel();
    await expect(layout.leftSidebar).toBeVisible();
    const panel = await layout.leftSidebar.boundingBox();
    const header = await layout.leftSidebarHeader.boundingBox();

    expect(panel).not.toBeNull();
    expect(header).not.toBeNull();

    // Header flush with top of panel
    expect(Math.abs(header!.y - panel!.y)).toBeLessThanOrEqual(2);
  });

  test('right panel: header pinned at top, footer pinned at bottom', async () => {
    await layout.openChatPanel();
    await expect(layout.rightSidebar).toBeVisible();
    const panel = await layout.rightSidebar.boundingBox();
    const header = await layout.rightSidebarHeader.boundingBox();
    const footer = await layout.rightSidebarFooter.boundingBox();

    expect(panel).not.toBeNull();
    expect(header).not.toBeNull();
    expect(footer).not.toBeNull();

    // Header flush with top of panel
    expect(Math.abs(header!.y - panel!.y)).toBeLessThanOrEqual(2);
    // Footer flush with bottom of panel
    expect(
      Math.abs(footer!.y + footer!.height - (panel!.y + panel!.height)),
    ).toBeLessThanOrEqual(2);
  });

  // ─── Requirement 3: Center content CLAMPED between panels, NO overlap ───

  test('center content does not overlap with left panel', async () => {
    await layout.openAiPanel();
    const left = await layout.leftSidebar.boundingBox();
    const center = await layout.centerInset.boundingBox();

    expect(left).not.toBeNull();
    expect(center).not.toBeNull();

    // Center left edge must be at or past the left panel right edge
    expect(center!.x).toBeGreaterThanOrEqual(left!.x + left!.width - 2);
  });

  test('center content does not overlap with right panel', async () => {
    await layout.openChatPanel();
    const right = await layout.rightSidebar.boundingBox();
    const center = await layout.centerInset.boundingBox();

    expect(right).not.toBeNull();
    expect(center).not.toBeNull();

    // Center right edge must be at or before the right panel left edge
    expect(center!.x + center!.width).toBeLessThanOrEqual(right!.x + 2);
  });

  test('center clamped with both panels open', async () => {
    await layout.openBothPanels();
    const left = await layout.leftSidebar.boundingBox();
    const right = await layout.rightSidebar.boundingBox();
    const center = await layout.centerInset.boundingBox();

    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(center).not.toBeNull();

    expect(center!.x).toBeGreaterThanOrEqual(left!.x + left!.width - 2);
    expect(center!.x + center!.width).toBeLessThanOrEqual(right!.x + 2);
  });

  test('opening chat panel keeps expanded AI panel open on desktop', async () => {
    await layout.openAiPanel();
    await expect(layout.leftSidebarHeader).toBeVisible();
    const leftBefore = await layout.leftSidebar.boundingBox();
    expect(leftBefore).not.toBeNull();
    expect(leftBefore!.width).toBeGreaterThan(200);

    await layout.openChatPanel();
    await expect(layout.rightSidebar).toBeVisible();
    await expect(layout.leftSidebarHeader).toBeVisible();

    const leftAfter = await layout.leftSidebar.boundingBox();
    expect(leftAfter).not.toBeNull();
    expect(leftAfter!.width).toBeGreaterThan(200);
  });

  test('compact viewport closes opposite panel when opening chat', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await layout.openAiPanel();
    await expect(layout.leftSidebarHeader).toBeVisible();

    await layout.openChatPanel();
    await expect(layout.rightSidebar).toBeVisible();

    const leftAfter = await layout.leftSidebar.boundingBox();
    expect(leftAfter).not.toBeNull();
    expect(leftAfter!.width).toBeLessThanOrEqual(80);
  });

  test('menu bar and panel headers occupy separate columns at same level', async () => {
    await layout.openChatPanel();
    await expect(layout.rightSidebar).toBeVisible();
    const menuTop = await layout.menuTop.boundingBox();
    const rightHeader = await layout.rightSidebarHeader.boundingBox();

    expect(menuTop).not.toBeNull();
    expect(rightHeader).not.toBeNull();

    // Both start at the top of the viewport (separate columns, no overlap)
    expect(rightHeader!.y).toBeLessThanOrEqual(5);
    // Right panel does not horizontally overlap with center menu bar
    expect(rightHeader!.x).toBeGreaterThanOrEqual(
      menuTop!.x + menuTop!.width - 2,
    );
  });

  // TODO: Trigger visibility depends on client-side hydration of PanelProviders context
  // test('trigger buttons hide when their panel is open', ...)

  // ─── Requirement 4: Center menu bar fixed at top, does not scroll ───

  test('menu bar stays fixed at top when content scrolls', async ({ page }) => {
    await expect(layout.menuTop).toBeVisible();
    const before = await layout.menuTop.evaluate((el) =>
      el.getBoundingClientRect().toJSON(),
    );
    expect(before.height).toBeGreaterThan(0);

    // Scroll the center content area (SidebarInset with overflow-y-auto)
    await layout.centerInset.evaluate((el) => el.scrollBy(0, 500));
    await page.waitForTimeout(100);

    await expect(layout.menuTop).toBeVisible();
    const after = await layout.menuTop.evaluate((el) =>
      el.getBoundingClientRect().toJSON(),
    );
    expect(after.height).toBeGreaterThan(0);
    // Menu bar Y position must not change after scroll
    expect(after.y).toBe(before.y);
  });

  // ─── Requirement 5: Context aside docked shell (@aside, max-md) respects right panel ───

  test('SidePanel right edge aligns with center column, not viewport', async ({
    page,
  }) => {
    // Below md the aside uses the docked SidePanel geometry; centered modal otherwise.
    await page.setViewportSize({ width: 767, height: 900 });
    await layout.open('/en/dho/hypha/coherence/select-settings-action');

    // Wait for the SidePanel to render — use the heading inside the panel
    const spaceSettingsHeading = page.getByText('Space Settings');
    await expect(spaceSettingsHeading).toBeVisible({ timeout: 10000 });

    // The SidePanel is the fixed-position ancestor
    const sidePanelBox = await spaceSettingsHeading.evaluate((el) => {
      let node: HTMLElement | null = el as HTMLElement;
      while (node && getComputedStyle(node).position !== 'fixed') {
        node = node.parentElement;
      }
      return node?.getBoundingClientRect() ?? null;
    });

    await layout.openChatPanel();
    // Wait for sidebar animation to settle
    await page.waitForTimeout(400);

    const rightSidebarBox = await layout.rightSidebar.boundingBox();

    // Re-measure SidePanel after chat panel opened (it should have shifted)
    const sidePanelBoxAfter = await spaceSettingsHeading.evaluate((el) => {
      let node: HTMLElement | null = el as HTMLElement;
      while (node && getComputedStyle(node).position !== 'fixed') {
        node = node.parentElement;
      }
      return node?.getBoundingClientRect() ?? null;
    });

    expect(sidePanelBoxAfter).not.toBeNull();
    expect(rightSidebarBox).not.toBeNull();

    // SidePanel right edge should not extend past the right sidebar left edge
    expect(sidePanelBoxAfter!.x + sidePanelBoxAfter!.width).toBeLessThanOrEqual(
      rightSidebarBox!.x + 2,
    );

    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('SidePanel top aligns with bottom of MenuTop', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 900 });
    await layout.open('/en/dho/hypha/coherence/select-settings-action');

    const spaceSettingsHeading = page.getByText('Space Settings');
    await expect(spaceSettingsHeading).toBeVisible({ timeout: 10000 });

    // Wait for --menu-top-height CSS variable to be set by MenuTop
    await page.waitForFunction(
      () =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--menu-top-height')
          .trim() !== '',
      { timeout: 5000 },
    );
    // Allow CSS variable to propagate to the SidePanel's computed style
    await page.waitForTimeout(500);

    // Read MenuTop position first
    await expect(layout.menuTop).toBeVisible();
    const menuTopBox = await layout.menuTop.evaluate((el) =>
      el.getBoundingClientRect().toJSON(),
    );

    // Read SidePanel position (the fixed-position ancestor of the heading)
    const sidePanelBox = await spaceSettingsHeading.evaluate((el) => {
      let node: HTMLElement | null = el as HTMLElement;
      while (node && getComputedStyle(node).position !== 'fixed') {
        node = node.parentElement;
      }
      return node?.getBoundingClientRect() ?? null;
    });

    expect(menuTopBox).not.toBeNull();
    expect(sidePanelBox).not.toBeNull();

    // SidePanel top should be approximately at MenuTop bottom
    const diff = Math.abs(
      sidePanelBox!.y - (menuTopBox!.y + menuTopBox!.height),
    );
    expect(diff).toBeLessThanOrEqual(5);

    await page.setViewportSize({ width: 1440, height: 900 });
  });
});
