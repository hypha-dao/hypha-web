import { test, expect } from '@playwright/test';
import { AiChatPanelPage } from './pages/ai-chat-panel.page';

test.describe('AI Chat Panel', () => {
  let chatPanel: AiChatPanelPage;

  test.beforeEach(async ({ page }) => {
    chatPanel = new AiChatPanelPage(page);
    await chatPanel.open();
  });

  test('should show toggle button on space page', async () => {
    await expect(chatPanel.openButton).toBeVisible();
  });

  test('should open panel when toggle button is clicked', async () => {
    await chatPanel.openPanel();
    await expect(chatPanel.headerText).toBeVisible();
  });

  test('should show sign-in prompt when not authenticated', async () => {
    await chatPanel.openPanel();
    await expect(chatPanel.signInPrompt).toBeVisible();
    await expect(chatPanel.signInButton).toBeVisible();
  });

  test('should close panel when close button is clicked', async () => {
    await chatPanel.openPanel();
    await expect(chatPanel.headerText).toBeVisible();
    await chatPanel.closePanel();
    await expect(chatPanel.headerText).not.toBeVisible();
    await expect(chatPanel.openButton).toBeVisible();
  });

  test('should show header with reset and close buttons', async () => {
    await chatPanel.openPanel();
    await expect(chatPanel.headerText).toBeVisible();
    await expect(chatPanel.closeButton).toBeVisible();
    await expect(chatPanel.resetButton).toBeVisible();
  });

  test('panel should stay fixed when page is scrolled', async ({ page }) => {
    await chatPanel.openPanel();
    const headerBefore = await chatPanel.headerText.boundingBox();
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300);
    const headerAfter = await chatPanel.headerText.boundingBox();
    expect(headerBefore).not.toBeNull();
    expect(headerAfter).not.toBeNull();
    expect(headerBefore!.y).toBe(headerAfter!.y);
  });
});
