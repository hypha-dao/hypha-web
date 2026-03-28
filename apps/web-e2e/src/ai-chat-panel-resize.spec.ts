import { test, expect } from '@playwright/test';
import { AiChatPanelPage } from './pages/ai-chat-panel.page';

const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const RESIZE_STEP = 10;

test.describe('AI Chat Panel — Resize Handle', () => {
  let chatPanel: AiChatPanelPage;

  test.beforeEach(async ({ page }) => {
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
      await expect(chatPanel.resizeHandle).toHaveAttribute(
        'aria-valuemin',
        String(MIN_WIDTH),
      );
      await expect(chatPanel.resizeHandle).toHaveAttribute(
        'aria-valuemax',
        String(MAX_WIDTH),
      );
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
      const dragDistance = 100;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + dragDistance, startY, { steps: 5 });
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
      expect(width).toBeGreaterThanOrEqual(MIN_WIDTH);
    });

    test('should not resize above maximum width', async ({ page }) => {
      const handle = chatPanel.resizeHandle;
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
      expect(width).toBeLessThanOrEqual(MAX_WIDTH);
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

      // Wait for the 200ms reset animation
      await page.waitForTimeout(250);

      const widthAfterReset = await chatPanel.getSidebarWidth();
      expect(widthAfterReset).toBe(DEFAULT_WIDTH);
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
      await page.waitForTimeout(250);

      await expect(handle).toHaveAttribute(
        'aria-valuenow',
        String(DEFAULT_WIDTH),
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
      await chatPanel.resizeHandle.focus();
      await page.keyboard.press('Home');

      const width = await chatPanel.getSidebarWidth();
      expect(width).toBe(MIN_WIDTH);
    });

    test('should jump to maximum width with End', async ({ page }) => {
      await chatPanel.resizeHandle.focus();
      await page.keyboard.press('End');

      const width = await chatPanel.getSidebarWidth();
      expect(width).toBe(MAX_WIDTH);
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
      await chatPanel.resizeHandle.focus();

      // Press ArrowLeft many times to try going below min
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('ArrowLeft');
      }

      const width = await chatPanel.getSidebarWidth();
      expect(width).toBe(MIN_WIDTH);
    });
  });

  test.describe('layout integration', () => {
    test('main content should reflow when sidebar is resized', async ({
      page,
    }) => {
      const main = page.locator('main').first();
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
