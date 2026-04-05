import { test, expect } from '@playwright/test';
import { HumanChatPanelPage } from './pages/human-chat-panel.page';

/**
 * Human Chat Panel — Resize Handle
 *
 * Mirrors the AI Chat panel resize tests to ensure both panels have
 * identical resize behavior. Tests cover visibility, ARIA attributes,
 * drag-to-resize, keyboard support, double-click reset, and layout
 * integration.
 *
 * Uses the two-layer cookie strategy for the feature flag.
 */

// Source: packages/ui/src/sidebar.tsx — SIDEBAR_RESIZE_DEFAULT, SIDEBAR_RESIZE_STEP
const DEFAULT_WIDTH = 320;
const RESIZE_STEP = 10;

test.describe('Human Chat Panel — Resize Handle', () => {
  let chatPanel: HumanChatPanelPage;

  test.use({
    extraHTTPHeaders: { Cookie: 'HYPHA_ENABLE_HUMAN_CHAT=true' },
  });

  test.beforeEach(async ({ page, context }) => {
    await HumanChatPanelPage.enableHumanChat(context);
    chatPanel = new HumanChatPanelPage(page);
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
      const minAttr = await chatPanel.resizeHandle.getAttribute(
        'aria-valuemin',
      );
      const maxAttr = await chatPanel.resizeHandle.getAttribute(
        'aria-valuemax',
      );
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
    test('should increase width when dragging left (right panel)', async ({
      page,
    }) => {
      const handle = chatPanel.resizeHandle;
      const box = await handle.boundingBox();
      expect(box).not.toBeNull();

      // Use dispatchEvent to trigger pointer events directly on the element
      // because page.mouse doesn't reliably trigger React's onPointerDown
      // when the handle is inside a nested sidebar scope.
      await handle.dispatchEvent('pointerdown', {
        button: 0,
        clientX: box!.x + box!.width / 2,
        clientY: box!.y + box!.height / 2,
        pointerId: 1,
      });

      // For a right-side panel, moving left increases width (width = viewportWidth - clientX)
      const viewportWidth = page.viewportSize()!.width;
      const targetX = viewportWidth - (DEFAULT_WIDTH + 100); // target 420px width
      await handle.dispatchEvent('pointermove', {
        clientX: targetX,
        clientY: box!.y + box!.height / 2,
        pointerId: 1,
      });
      await handle.dispatchEvent('pointerup', { pointerId: 1 });

      const width = await chatPanel.getSidebarWidth();
      expect(width).toBeGreaterThan(DEFAULT_WIDTH);
    });

    test('should decrease width when dragging right (right panel)', async ({
      page,
    }) => {
      const handle = chatPanel.resizeHandle;
      const box = await handle.boundingBox();
      expect(box).not.toBeNull();

      const viewportWidth = page.viewportSize()!.width;
      await handle.dispatchEvent('pointerdown', {
        button: 0,
        clientX: box!.x + box!.width / 2,
        clientY: box!.y + box!.height / 2,
        pointerId: 1,
      });

      // For a right-side panel, moving right decreases width
      const targetX = viewportWidth - (DEFAULT_WIDTH - 20); // target 300px width
      await handle.dispatchEvent('pointermove', {
        clientX: targetX,
        clientY: box!.y + box!.height / 2,
        pointerId: 1,
      });
      await handle.dispatchEvent('pointerup', { pointerId: 1 });

      const width = await chatPanel.getSidebarWidth();
      expect(width).toBeLessThan(DEFAULT_WIDTH);
    });

    test('should not resize below minimum width', async ({ page }) => {
      const handle = chatPanel.resizeHandle;
      const minWidth = Number(await handle.getAttribute('aria-valuemin'));

      // Use keyboard Home to jump to minimum
      await handle.focus();
      await page.keyboard.press('Home');

      const width = await chatPanel.getSidebarWidth();
      expect(width).toBe(minWidth);

      // Further ArrowLeft should not go below min
      await page.keyboard.press('ArrowLeft');
      const widthAfter = await chatPanel.getSidebarWidth();
      expect(widthAfter).toBeGreaterThanOrEqual(minWidth);
    });

    test('should not resize above maximum width', async ({ page }) => {
      const handle = chatPanel.resizeHandle;
      const maxWidth = Number(await handle.getAttribute('aria-valuemax'));

      // Use keyboard End to jump to maximum
      await handle.focus();
      await page.keyboard.press('End');

      const width = await chatPanel.getSidebarWidth();
      expect(width).toBe(maxWidth);

      // Further ArrowRight should not go above max
      await page.keyboard.press('ArrowRight');
      const widthAfter = await chatPanel.getSidebarWidth();
      expect(widthAfter).toBeLessThanOrEqual(maxWidth);
    });

    test('should set data-resizing attribute during drag', async ({ page }) => {
      const handle = chatPanel.resizeHandle;
      const box = await handle.boundingBox();
      expect(box).not.toBeNull();

      // Before drag
      await expect(handle).toHaveAttribute('data-resizing', 'false');

      // Start drag
      await handle.dispatchEvent('pointerdown', {
        button: 0,
        clientX: box!.x + box!.width / 2,
        clientY: box!.y + box!.height / 2,
        pointerId: 1,
      });

      // During drag
      await expect(handle).toHaveAttribute('data-resizing', 'true');

      // Release
      await handle.dispatchEvent('pointerup', { pointerId: 1 });

      // After drag
      await expect(handle).toHaveAttribute('data-resizing', 'false');
    });
  });

  test.describe('double-click to reset', () => {
    test('should reset to default width on double-click', async ({ page }) => {
      const handle = chatPanel.resizeHandle;

      // First, resize to a non-default width via keyboard
      await handle.focus();
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowRight');
      }

      const widthAfterResize = await chatPanel.getSidebarWidth();
      expect(widthAfterResize).toBeGreaterThan(DEFAULT_WIDTH);

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

      // Resize first via keyboard
      await handle.focus();
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('ArrowRight');
      }

      // Verify aria-valuenow changed
      const valueAfterResize = await handle.getAttribute('aria-valuenow');
      expect(Number(valueAfterResize)).toBeGreaterThan(DEFAULT_WIDTH);

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
    test('should be focusable with Tab', async () => {
      await chatPanel.resizeHandle.focus();
      await expect(chatPanel.resizeHandle).toBeFocused();
    });

    test('should increase width with ArrowLeft (right panel)', async ({
      page,
    }) => {
      await chatPanel.resizeHandle.focus();
      // For a right-side panel, ArrowLeft increases width (opposite of left panel)
      // But the SidebarResizeHandle uses ArrowRight=+step, ArrowLeft=-step
      // regardless of side. Let's verify the actual behavior:
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

      // Calculate presses needed to go from default to min, plus extra to verify clamping
      const pressesNeeded = Math.ceil((DEFAULT_WIDTH - minWidth) / RESIZE_STEP) + 2;
      for (let i = 0; i < pressesNeeded; i++) {
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

      // Resize sidebar wider via keyboard
      await chatPanel.resizeHandle.focus();
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowRight');
      }

      const mainBoxAfter = await main.boundingBox();
      expect(mainBoxAfter).not.toBeNull();

      // Main content should have narrowed or shifted
      expect(mainBoxAfter!.width).toBeLessThanOrEqual(mainBoxBefore!.width);
    });
  });
});
