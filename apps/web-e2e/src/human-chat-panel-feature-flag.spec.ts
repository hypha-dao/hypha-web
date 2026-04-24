import { test, expect } from '@playwright/test';
import { HumanChatPanelPage } from './pages/human-chat-panel.page';
import {
  addEnableHumanChatCookie,
  extraHttpHeadersEnableHumanChat,
} from './test-helpers/human-chat-e2e-cookies';

/**
 * Human Chat defaults **off** when cookie and `NEXT_PUBLIC_ENABLE_HUMAN_CHAT` are unset.
 * Opt in: `HYPHA_ENABLE_HUMAN_CHAT=true` or env. Kill-switch: `HYPHA_DISABLE_HUMAN_CHAT=true`.
 */

test.describe('Human Chat Panel — default (off)', () => {
  test('should not render Human Chat trigger on space page without opt-in', async ({
    page,
  }) => {
    await page.goto('/en/dho/hypha/agreements');
    await page.waitForLoadState('domcontentloaded');

    const chatButton = page.getByRole('button', {
      name: /open chat panel/i,
    });
    await expect(chatButton).not.toBeVisible();
  });
});

test.describe('Human Chat Panel — opt-in (enabled)', () => {
  test.use({
    extraHTTPHeaders: extraHttpHeadersEnableHumanChat,
  });

  let chatPanel: HumanChatPanelPage;

  test.beforeEach(async ({ page, context }) => {
    await addEnableHumanChatCookie(context);
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
  test.use({
    extraHTTPHeaders: extraHttpHeadersEnableHumanChat,
  });

  test.beforeEach(async ({ context, baseURL }) => {
    await addEnableHumanChatCookie(context);
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
    await page.goto('/en/dho/hypha/agreements');
    await page.waitForLoadState('domcontentloaded');

    const chatButton = page.getByRole('button', {
      name: /open chat panel/i,
    });
    await expect(chatButton).not.toBeVisible();
  });

  test('should render page content normally', async ({ page }) => {
    await page.goto('/en/dho/hypha/agreements');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Agreements')).toBeVisible();
  });
});
