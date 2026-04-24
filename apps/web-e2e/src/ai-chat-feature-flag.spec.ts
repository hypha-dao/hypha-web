import { test, expect } from '@playwright/test';
import { AiChatPanelPage } from './pages/ai-chat-panel.page';

/** Must match `packages/cookie` → `HYPHA_ENABLE_AI_CHAT` */
const HYPHA_ENABLE_AI_CHAT = 'HYPHA_ENABLE_AI_CHAT' as const;

/**
 * AI Chat (left) defaults **on**; set `HYPHA_ENABLE_AI_CHAT=false` or
 * `NEXT_PUBLIC_ENABLE_AI_CHAT=false` to hide.
 */

test.describe('AI Chat Panel — Feature Flag Enabled', () => {
  let chatPanel: AiChatPanelPage;

  test.beforeEach(async ({ page }) => {
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

test.describe('AI Chat Panel — opt-out (cookie off)', () => {
  test.use({
    extraHTTPHeaders: { Cookie: `${HYPHA_ENABLE_AI_CHAT}=false` },
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: HYPHA_ENABLE_AI_CHAT,
        value: 'false',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
  });

  test('should not render AI trigger on space page', async ({ page }) => {
    await page.goto('/en/dho/hypha/agreements');
    await page.waitForLoadState('domcontentloaded');

    const aiButton = page.getByRole('button', { name: /open ai chat/i });
    await expect(aiButton).not.toBeVisible();
  });
});
