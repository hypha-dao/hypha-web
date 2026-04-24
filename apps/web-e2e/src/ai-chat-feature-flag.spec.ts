import { test, expect } from '@playwright/test';
import { AiChatPanelPage } from './pages/ai-chat-panel.page';
import {
  addEnableAiChatCookie,
  extraHttpHeadersEnableAiChat,
} from './test-helpers/ai-chat-e2e-cookies';

/**
 * AI Chat (left panel) defaults off; opt in via `HYPHA_ENABLE_AI_CHAT` / `NEXT_PUBLIC_ENABLE_AI_CHAT`.
 */

test.describe('AI Chat Panel — Feature Flag Enabled', () => {
  test.use({
    extraHTTPHeaders: extraHttpHeadersEnableAiChat,
  });

  let chatPanel: AiChatPanelPage;

  test.beforeEach(async ({ page, context }) => {
    await addEnableAiChatCookie(context);
    chatPanel = new AiChatPanelPage(page);
    await chatPanel.open();
  });

  test('should render the AI panel trigger button on a space page', async () => {
    await expect(chatPanel.openButton).toBeVisible();
    await expect(chatPanel.openButton).toHaveAttribute(
      'aria-label',
      /open ai chat/i,
    );
  });

  test('should open panel with header, reset, and close buttons', async () => {
    await chatPanel.openPanel();

    await expect(chatPanel.headerText).toBeVisible();
    await expect(chatPanel.closeButton).toBeVisible();
    await expect(chatPanel.resetButton).toBeVisible();
  });

  test('should show sign-in prompt when not authenticated', async () => {
    await chatPanel.openPanel();

    await expect(chatPanel.signInPrompt).toBeVisible();
    await expect(chatPanel.signInButton).toBeVisible();
  });

  test('should close panel and restore trigger button', async () => {
    await chatPanel.openPanel();
    await expect(chatPanel.headerText).toBeVisible();

    await chatPanel.closePanel();

    await expect(chatPanel.openButton).toBeVisible();
  });

  test('should not render AI trigger button on non-space pages', async ({
    page,
  }) => {
    await page.goto('/my-spaces');
    await page.waitForLoadState('domcontentloaded');

    const aiButton = page.getByRole('button', {
      name: /open ai chat panel/i,
    });
    await expect(aiButton).not.toBeVisible();
  });
});

test.describe('AI Chat Panel — default off (no opt-in cookie)', () => {
  test('should not render AI trigger button on space page', async ({
    page,
  }) => {
    await page.goto('/en/dho/hypha/agreements');
    await page.waitForLoadState('domcontentloaded');

    const aiButton = page.getByRole('button', {
      name: /open ai chat/i,
    });
    await expect(aiButton).not.toBeVisible();
  });

  test('should not render left AI sidebar markup', async ({ page }) => {
    await page.goto('/en/dho/hypha/agreements');
    await page.waitForLoadState('domcontentloaded');

    const leftSidebar = page.locator(
      '[data-side="left"] [data-sidebar="sidebar"]',
    );
    await expect(leftSidebar).toHaveCount(0);
  });

  test('should render page content normally', async ({ page }) => {
    await page.goto('/en/dho/hypha/agreements');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Members')).toBeVisible();
    await expect(page.getByText('Agreements')).toBeVisible();
  });
});
