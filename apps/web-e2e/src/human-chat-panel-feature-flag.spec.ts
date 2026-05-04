import { test, expect } from '@playwright/test';
import { HumanChatPanelPage } from './pages/human-chat-panel.page';
import { gotoApp } from './utils/nav-url';

/**
 * Default runtime: off. The enabled describe block sets `HYPHA_ENABLE_HUMAN_CHAT=true`.
 * Emergency rollback: `HYPHA_DISABLE_HUMAN_CHAT=true`.
 */

test.describe('Human Chat Panel — feature flag enabled (cookie)', () => {
  let chatPanel: HumanChatPanelPage;

  test.beforeEach(async ({ context, page, baseURL }) => {
    await HumanChatPanelPage.enableHumanChat(context, baseURL);
    chatPanel = new HumanChatPanelPage(page);
    await chatPanel.open();
  });

  test('should render the Human Chat trigger button on a space page', async () => {
    await expect(chatPanel.openButton).toBeVisible();
    await expect(chatPanel.openButton).toHaveAttribute(
      'aria-label',
      /open chat panel/i,
    );
  });

  test('should open panel with header and close button', async () => {
    await chatPanel.openPanel();

    await expect(chatPanel.headerText).toBeVisible();
    await expect(chatPanel.closeButton).toBeVisible();
  });

  test('should show chat bar with input and send button', async () => {
    await chatPanel.openPanel();

    await expect(chatPanel.chatInput).toBeVisible();
    await expect(chatPanel.sendButton).toBeVisible();
  });

  test('should close panel and restore trigger button', async () => {
    await chatPanel.openPanel();
    await expect(chatPanel.headerText).toBeVisible();

    await chatPanel.closePanel();

    await expect(chatPanel.openButton).toBeVisible();
  });
});

test.describe('Human Chat Panel — kill switch (disabled)', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: 'HYPHA_DISABLE_HUMAN_CHAT',
        value: 'true',
        domain: new URL(baseURL ?? 'http://127.0.0.1:3000').hostname,
        path: '/',
      },
    ]);
  });

  test('should not render Human Chat trigger button on space page', async ({
    page,
  }) => {
    await gotoApp(page, '/en/dho/hypha/agreements');
    await page.waitForLoadState('domcontentloaded');

    const chatButton = page.getByRole('button', {
      name: /open chat panel/i,
    });
    await expect(chatButton).not.toBeVisible();
  });

  test('should render page content normally', async ({ page }) => {
    await gotoApp(page, '/en/dho/hypha/agreements');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Agreements')).toBeVisible();
  });
});
