import { test, expect } from '@playwright/test';
import { HumanChatPanelPage } from './pages/human-chat-panel.page';

/**
 * E2E tests for the Human Chat Panel Header layout.
 *
 * The header mirrors the AI panel header layout but right-aligned:
 *   [CloseButton] ---space--- [Title] [ChatBubbleIcon]
 *
 * The ChatBubbleIcon has a primary background (rounded-xl bg-primary)
 * matching the SparklesIcon style in the AI panel header.
 */
test.describe('Human Chat Panel Header Layout', () => {
  let chatPanel: HumanChatPanelPage;

  test.beforeEach(async ({ page }) => {
    chatPanel = new HumanChatPanelPage(page);
    await chatPanel.open();
    await chatPanel.openPanel();
  });

  test('header shows "Chat" title text', async () => {
    await expect(chatPanel.headerText).toBeVisible();
    await expect(chatPanel.headerText).toHaveText('Chat');
  });

  test('header shows chat icon with primary background', async () => {
    await expect(chatPanel.headerIcon).toBeVisible();
    // Icon container has the same styling as the AI panel SparklesIcon
    await expect(chatPanel.headerIcon).toHaveClass(/bg-primary/);
    await expect(chatPanel.headerIcon).toHaveClass(/rounded-xl/);
  });

  test('header chat icon contains an SVG (MessageCircle)', async () => {
    const svg = chatPanel.headerIcon.locator('svg');
    await expect(svg).toBeVisible();
  });

  test('close button is positioned to the left of the title', async () => {
    const closeBox = await chatPanel.closeButton.boundingBox();
    const titleBox = await chatPanel.headerText.boundingBox();

    expect(closeBox).not.toBeNull();
    expect(titleBox).not.toBeNull();

    // Close button's right edge should be to the left of the title's left edge
    expect(closeBox!.x + closeBox!.width).toBeLessThan(titleBox!.x);
  });

  test('chat icon is positioned to the right of the title', async () => {
    const titleBox = await chatPanel.headerText.boundingBox();
    const iconBox = await chatPanel.headerIcon.boundingBox();

    expect(titleBox).not.toBeNull();
    expect(iconBox).not.toBeNull();

    // Icon's left edge should be to the right of the title's right edge
    expect(iconBox!.x).toBeGreaterThan(titleBox!.x + titleBox!.width - 1);
  });

  test('header layout is mirrored: close button left, title+icon right', async ({
    page,
  }) => {
    const header = page
      .locator('[data-side="right"] [data-sidebar="header"]')
      .first();
    const headerBox = await header.boundingBox();
    const closeBox = await chatPanel.closeButton.boundingBox();
    const iconBox = await chatPanel.headerIcon.boundingBox();

    expect(headerBox).not.toBeNull();
    expect(closeBox).not.toBeNull();
    expect(iconBox).not.toBeNull();

    // Close button should be in the left half of the header
    const headerCenter = headerBox!.x + headerBox!.width / 2;
    expect(closeBox!.x + closeBox!.width / 2).toBeLessThan(headerCenter);

    // Chat icon should be in the right half of the header
    expect(iconBox!.x + iconBox!.width / 2).toBeGreaterThan(headerCenter);
  });
});
