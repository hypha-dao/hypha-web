import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { HumanChatPanelPage } from './pages/human-chat-panel.page';
import { gotoApp } from './utils/nav-url';

const HUMAN_CHAT_COOKIE = 'HYPHA_ENABLE_HUMAN_CHAT=true';
const SPACE_A = 'hypha';
const SPACE_B = 'hypha-platform';

async function openSpaceChat(page: Page, spaceSlug: string) {
  const chatPanel = new HumanChatPanelPage(page);
  await gotoApp(page, `/en/dho/${spaceSlug}/coherence`);
  await page.waitForLoadState('domcontentloaded');
  await chatPanel.openPanel();
}

test.describe('Global Call Dock - navigation persistence', () => {
  test.setTimeout(90_000);
  test.use({
    extraHTTPHeaders: {
      Cookie: HUMAN_CHAT_COOKIE,
    },
  });

  test.beforeEach(async ({ context, baseURL }) => {
    await HumanChatPanelPage.enableHumanChat(context, baseURL);
  });

  test('dock is hidden when no call is active', async ({ page }) => {
    await openSpaceChat(page, SPACE_A);
    const a11y = await new AxeBuilder({ page }).analyze();
    expect(a11y.violations).toEqual([]);
    const dock = page.getByTestId('global-call-dock');
    await expect(dock).toHaveCount(0);
  });

  test.fixme(
    'call stays connected after navigating to another page in same space',
    async ({ page }) => {
      await openSpaceChat(page, SPACE_A);

      // Start video from panel toolbar.
      const panel = page.locator(
        '[data-side="right"] [data-sidebar="sidebar"]',
      );
      await panel.getByRole('button', { name: /video/i }).first().click();

      const dock = page.getByTestId('global-call-dock');
      await expect(dock).toBeVisible();

      await gotoApp(page, `/en/dho/${SPACE_A}/signal`);
      await page.waitForLoadState('domcontentloaded');
      await expect(dock).toBeVisible();
    },
  );

  test.fixme(
    'call stays connected after navigating to a different space',
    async ({ page }) => {
      await openSpaceChat(page, SPACE_A);

      const panel = page.locator(
        '[data-side="right"] [data-sidebar="sidebar"]',
      );
      await panel.getByRole('button', { name: /video/i }).first().click();

      const dock = page.getByTestId('global-call-dock');
      await expect(dock).toBeVisible();

      await gotoApp(page, `/en/dho/${SPACE_B}/agreements`);
      await page.waitForLoadState('domcontentloaded');
      await expect(dock).toBeVisible();
    },
  );

  test.fixme('dock geometry persists after drag + reload', async ({ page }) => {
    await openSpaceChat(page, SPACE_A);

    const panel = page.locator('[data-side="right"] [data-sidebar="sidebar"]');
    await panel.getByRole('button', { name: /video/i }).first().click();

    const dock = page.getByTestId('global-call-dock');
    await expect(dock).toBeVisible();
    const signatureBeforeDrag = await dock.evaluate((el) => {
      const css = window.getComputedStyle(el);
      return `${css.right}|${css.bottom}|${css.transform}`;
    });

    const box = await dock.boundingBox();
    if (box) {
      const dragStartX = box.x + box.width / 2;
      const dragStartY = box.y + 18;
      await page.mouse.move(dragStartX, dragStartY);
      await page.mouse.down();
      await page.mouse.move(dragStartX - 110, dragStartY - 70, { steps: 8 });
      await page.mouse.up();
    }
    await expect
      .poll(async () => {
        const signature = await dock.evaluate((el) => {
          const css = window.getComputedStyle(el);
          return `${css.right}|${css.bottom}|${css.transform}`;
        });
        return signature;
      })
      .not.toBe(signatureBeforeDrag);

    const before = await dock.evaluate((el) => ({
      right: window.getComputedStyle(el).right,
      bottom: window.getComputedStyle(el).bottom,
      transform: window.getComputedStyle(el).transform,
    }));

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(dock).toBeVisible();

    const after = await dock.evaluate((el) => ({
      right: window.getComputedStyle(el).right,
      bottom: window.getComputedStyle(el).bottom,
      transform: window.getComputedStyle(el).transform,
    }));

    expect(after).toEqual(before);
  });
});
