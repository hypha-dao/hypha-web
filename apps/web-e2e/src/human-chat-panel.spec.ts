import { test, expect } from '@playwright/test';
import { HumanChatPanelPage } from './pages/human-chat-panel.page';
import {
  addEnableHumanChatCookie,
  extraHttpHeadersEnableHumanChat,
} from './test-helpers/human-chat-e2e-cookies';

test.describe('Human Chat Panel', () => {
  test.use({
    extraHTTPHeaders: extraHttpHeadersEnableHumanChat,
  });

  let chatPanel: HumanChatPanelPage;

  test.beforeEach(async ({ page, context }) => {
    await addEnableHumanChatCookie(context);
    chatPanel = new HumanChatPanelPage(page);
    await chatPanel.open();
  });

  test('should show trigger button on space page', async () => {
    await expect(chatPanel.openButton).toBeVisible();
  });

  test('should open panel when trigger button is clicked', async () => {
    await chatPanel.openPanel();
    await expect(chatPanel.headerText).toBeVisible();
  });

  test('should show header with MessageCircle icon and "Chat" title', async ({
    page,
  }) => {
    await chatPanel.openPanel();
    await expect(chatPanel.headerText).toBeVisible();
    await expect(chatPanel.closeButton).toBeVisible();
  });

  test('should close panel when close button is clicked', async () => {
    await chatPanel.openPanel();
    await expect(chatPanel.headerText).toBeVisible();
    await chatPanel.closePanel();
    // After close, the trigger button reappears
    await expect(chatPanel.openButton).toBeVisible();
  });

  test('should show chat bar with textarea and send button', async () => {
    await chatPanel.openPanel();
    await expect(chatPanel.chatInput).toBeVisible();
    await expect(chatPanel.sendButton).toBeVisible();
  });

  test('send button should be disabled when textarea is empty', async () => {
    await chatPanel.openPanel();
    // Send button should have disabled state (cursor-not-allowed class)
    await expect(chatPanel.sendButton).toBeDisabled();
  });

  test('send button should be enabled when textarea has text', async ({
    page,
  }) => {
    await chatPanel.openPanel();
    await chatPanel.chatInput.fill('Hello world');
    // After typing, send button should be enabled
    await expect(chatPanel.sendButton).not.toBeDisabled();
  });

  test('panel should stay fixed when page is scrolled', async ({ page }) => {
    await chatPanel.openPanel();
    const headerBefore = await chatPanel.headerText.boundingBox();
    await page.evaluate(() => window.scrollBy(0, 500));
    await expect(chatPanel.headerText).toBeVisible();
    const headerAfter = await chatPanel.headerText.boundingBox();
    expect(headerBefore).not.toBeNull();
    expect(headerAfter).not.toBeNull();
    expect(headerBefore!.y).toBe(headerAfter!.y);
  });

  test('trigger button should have correct aria-label', async () => {
    await expect(chatPanel.openButton).toHaveAttribute(
      'aria-label',
      /open chat panel/i,
    );
  });

  test('close button should have correct attributes', async () => {
    await chatPanel.openPanel();
    await expect(chatPanel.closeButton).toBeVisible();
    await expect(chatPanel.closeButton).toHaveAttribute(
      'title',
      'Hide chat panel',
    );
    await expect(chatPanel.closeButton).toHaveAttribute(
      'aria-label',
      'Close panel',
    );
  });

  test('Shift+Enter should not clear input (adds newline)', async () => {
    await chatPanel.openPanel();
    await chatPanel.chatInput.fill('Line one');
    await chatPanel.chatInput.press('Shift+Enter');
    // Input should still have text (not cleared)
    const value = await chatPanel.chatInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
    expect(value).toContain('Line one');
  });

  test('click Send without auth should not clear input (no room joined)', async () => {
    await chatPanel.openPanel();
    await chatPanel.chatInput.fill('Test message');
    await expect(chatPanel.sendButton).not.toBeDisabled();
    await chatPanel.sendButton.click();
    // Without auth, handleSend early-returns (no roomId), input is preserved
    await expect(chatPanel.chatInput).toHaveValue('Test message');
  });

  test('Enter without auth should not clear input (no room joined)', async () => {
    await chatPanel.openPanel();
    await chatPanel.chatInput.fill('Test message via Enter');
    await expect(chatPanel.sendButton).not.toBeDisabled();
    await chatPanel.chatInput.press('Enter');
    // Without auth, handleSend early-returns (no roomId), input is preserved
    await expect(chatPanel.chatInput).toHaveValue('Test message via Enter');
  });
});
