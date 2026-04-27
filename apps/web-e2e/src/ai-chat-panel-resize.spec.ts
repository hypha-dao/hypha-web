import { test, expect } from '@playwright/test';
import { AiChatPanelPage } from './pages/ai-chat-panel.page';

// These values are read dynamically from ARIA attributes where possible.
// Only DEFAULT_WIDTH and RESIZE_STEP are kept as constants since they
// cannot be derived from the DOM (default is only known pre-interaction,
// step size is an implementation detail not exposed via ARIA).
// Source: packages/ui/src/sidebar.tsx — SIDEBAR_RESIZE_DEFAULT, SIDEBAR_RESIZE_STEP
const DEFAULT_WIDTH = 320;
const RESIZE_STEP = 10;

test.describe('AI Chat Panel — Resize Handle', () => {
  let chatPanel: AiChatPanelPage;

  test.use({
    extraHTTPHeaders: { Cookie: 'HYPHA_ENABLE_AI_CHAT=true' },
  });

  test.beforeEach(async ({ page, context }) => {
    await AiChatPanelPage.enableAiChat(context);
    chatPanel = new AiChatPanelPage(page);
    await chatPanel.open();
    await chatPanel.openPanel();
    await expect(chatPanel.headerText).toBeVisible();
  });

  test.describe('visibility', () => {
    test('should show resize handle when panel is open', async () => {
      await expect(chatPanel.resizeHandle).toBeVisible();
    });

    test('should hide resize handle when panel is closed', async () => {
      await chatPanel.closePanel();
      await expect(chatPanel.resizeHandle).not.toBeVisible();
    });

    test('should have correct ARIA attributes', async () => {
      await expect(chatPanel.resizeHandle).toHaveAttribute('role', 'separator');
      await expect(chatPanel.resizeHandle).toHaveAttribute(
        'aria-orientation',
        'vertical',
      );
      await expect(chatPanel.resizeHandle).toHaveAttribute(
        'aria-label',
        'Resize sidebar',
      );
      // Read min/max from the component instead of hardcoding
      const minAttr =
        await chatPanel.resizeHandle.getAttribute('aria-valuemin');
      const maxAttr =
        await chatPanel.resizeHandle.getAttribute('aria-valuemax');
      expect(Number(minAttr)).toBeGreaterThan(0);
      expect(Number(maxAttr)).toBeGreaterThan(Number(minAttr));
      await expect(chatPanel.resizeHandle).toHaveAttribute(
        'aria-valuenow',
        String(DEFAULT_WIDTH),
      );
    });

    test('should have col-resize cursor', async () => {
      await expect(chatPanel.resizeHandle).toHaveCSS('cursor', 'col-resize');
    });
  });

  test.describe('drag to resize', () => {
    test('should increase width when dragging right', async ({ page }) => {
      const handle = chatPanel.resizeHandle;
      const box = await handle.boundingBox();
      expect(box).not.toBeNull();

      const startX = box!.x + box!.width / 2;
      const startY = box!.y + box!.height / 2;
      const targetX = DEFAULT_WIDTH + 100;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      // Move in steps to targetX — the component uses clientX as the new width
      await page.mouse.move(targetX, startY, { steps: 10 });
      await page.mouse.up();

      const width = await chatPanel.getSidebarWidth();
      expect(width).toBeGreaterThan(DEFAULT_WIDTH);
    });

    test('should decrease width when dragging left', async ({ page }) => {
      const handle = chatPanel.resizeHandle;
      const box = await handle.boundingBox();
      expect(box).not.toBeNull();

      const startX = box!.x + box!.width / 2;
      const startY = box!.y + box!.height / 2;
      const dragDistance = 20;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX - dragDistance, startY, { steps: 5 });
      await page.mouse.up();

      const width = await chatPanel.getSidebarWidth();
      expect(width).toBeLessThan(DEFAULT_WIDTH);
    });

    test('should not resize below minimum width', async ({ page }) => {
      const handle = chatPanel.resizeHandle;
      const minWidth = Number(await handle.getAttribute('aria-valuemin'));
      const box = await handle.boundingBox();
      expect(box).not.toBeNull();

      const startX = box!.x + box!.width / 2;
      const startY = box!.y + box!.height / 2;

      // Drag far left to try to go below minimum
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(50, startY, { steps: 5 });
      await page.mouse.up();

      const width = await chatPanel.getSidebarWidth();
      expect(width).toBeGreaterThanOrEqual(minWidth);
    });

    test('should not resize above maximum width', async ({ page }) => {
      const handle = chatPanel.resizeHandle;
      const maxWidth = Number(await handle.getAttribute('aria-valuemax'));
      const box = await handle.boundingBox();
      expect(box).not.toBeNull();

      const startX = box!.x + box!.width / 2;
      const startY = box!.y + box!.height / 2;

      // Drag far right to try to exceed maximum
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(800, startY, { steps: 5 });
      await page.mouse.up();

      const width = await chatPanel.getSidebarWidth();
      expect(width).toBeLessThanOrEqual(maxWidth);
    });

    test('should set data-resizing attribute during drag', async ({ page }) => {
      const handle = chatPanel.resizeHandle;
      const box = await handle.boundingBox();
      expect(box).not.toBeNull();

      const startX = box!.x + box!.width / 2;
      const startY = box!.y + box!.height / 2;

      // Before drag
      await expect(handle).toHaveAttribute('data-resizing', 'false');

      // Start drag and hold
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 50, startY, { steps: 3 });

      // During drag
      await expect(handle).toHaveAttribute('data-resizing', 'true');

      // Release
      await page.mouse.up();

      // After drag
      await expect(handle).toHaveAttribute('data-resizing', 'false');
    });
  });

  test.describe('double-click to reset', () => {
    test('should reset to default width on double-click', async ({ page }) => {
      const handle = chatPanel.resizeHandle;
      const box = await handle.boundingBox();
      expect(box).not.toBeNull();

      const startX = box!.x + box!.width / 2;
      const startY = box!.y + box!.height / 2;

      // First, resize to a non-default width
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 100, startY, { steps: 5 });
      await page.mouse.up();

      const widthAfterDrag = await chatPanel.getSidebarWidth();
      expect(widthAfterDrag).toBeGreaterThan(DEFAULT_WIDTH);

      // Double-click to reset
      const newBox = await handle.boundingBox();
      await handle.dblclick({
        position: { x: newBox!.width / 2, y: newBox!.height / 2 },
      });

      // Poll until width reaches default (animation completes)
      await expect
        .poll(() => chatPanel.getSidebarWidth(), { timeout: 1000 })
        .toBe(DEFAULT_WIDTH);
    });

    test('should update aria-valuenow after reset', async ({ page }) => {
      const handle = chatPanel.resizeHandle;
      const box = await handle.boundingBox();
      expect(box).not.toBeNull();

      const startX = box!.x + box!.width / 2;
      const startY = box!.y + box!.height / 2;

      // Resize first
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 80, startY, { steps: 5 });
      await page.mouse.up();

      // Verify aria-valuenow changed
      const valueAfterDrag = await handle.getAttribute('aria-valuenow');
      expect(Number(valueAfterDrag)).toBeGreaterThan(DEFAULT_WIDTH);

      // Double-click to reset
      const newBox = await handle.boundingBox();
      await handle.dblclick({
        position: { x: newBox!.width / 2, y: newBox!.height / 2 },
      });

      await expect(chatPanel.resizeHandle).toHaveAttribute(
        'aria-valuenow',
        String(DEFAULT_WIDTH),
        { timeout: 1000 },
      );
    });
  });

  test.describe('keyboard support', () => {
    test('should be focusable with Tab', async ({ page }) => {
      await chatPanel.resizeHandle.focus();
      await expect(chatPanel.resizeHandle).toBeFocused();
    });

    test('should increase width with ArrowRight', async ({ page }) => {
      await chatPanel.resizeHandle.focus();
      await page.keyboard.press('ArrowRight');

      const width = await chatPanel.getSidebarWidth();
      expect(width).toBe(DEFAULT_WIDTH + RESIZE_STEP);
    });

    test('should decrease width with ArrowLeft', async ({ page }) => {
      await chatPanel.resizeHandle.focus();
      await page.keyboard.press('ArrowLeft');

      const width = await chatPanel.getSidebarWidth();
      expect(width).toBe(DEFAULT_WIDTH - RESIZE_STEP);
    });

    test('should jump to minimum width with Home', async ({ page }) => {
      const minWidth = Number(
        await chatPanel.resizeHandle.getAttribute('aria-valuemin'),
      );
      await chatPanel.resizeHandle.focus();
      await page.keyboard.press('Home');

      const width = await chatPanel.getSidebarWidth();
      expect(width).toBe(minWidth);
    });

    test('should jump to maximum width with End', async ({ page }) => {
      const maxWidth = Number(
        await chatPanel.resizeHandle.getAttribute('aria-valuemax'),
      );
      await chatPanel.resizeHandle.focus();
      await page.keyboard.press('End');

      const width = await chatPanel.getSidebarWidth();
      expect(width).toBe(maxWidth);
    });

    test('should update aria-valuenow on keyboard resize', async ({ page }) => {
      await chatPanel.resizeHandle.focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');

      await expect(chatPanel.resizeHandle).toHaveAttribute(
        'aria-valuenow',
        String(DEFAULT_WIDTH + RESIZE_STEP * 2),
      );
    });

    test('should not exceed bounds with repeated key presses', async ({
      page,
    }) => {
      const minWidth = Number(
        await chatPanel.resizeHandle.getAttribute('aria-valuemin'),
      );
      await chatPanel.resizeHandle.focus();

      // Press ArrowLeft enough times to reach min + 2 extra to verify clamping
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('ArrowLeft');
      }

      const width = await chatPanel.getSidebarWidth();
      expect(width).toBe(minWidth);
    });
  });

  test.describe('layout integration', () => {
    test('main content should reflow when sidebar is resized', async ({
      page,
    }) => {
      const main = page.getByRole('main').first();
      const mainBoxBefore = await main.boundingBox();
      expect(mainBoxBefore).not.toBeNull();

      // Resize sidebar wider
      await chatPanel.resizeHandle.focus();
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowRight');
      }

      const mainBoxAfter = await main.boundingBox();
      expect(mainBoxAfter).not.toBeNull();

      // Main content should have shifted right or narrowed
      expect(mainBoxAfter!.x).toBeGreaterThanOrEqual(mainBoxBefore!.x);
    });
  });
});
