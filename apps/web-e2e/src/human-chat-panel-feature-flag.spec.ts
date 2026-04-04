import { test, expect } from '@playwright/test';
import { HumanChatPanelPage } from './pages/human-chat-panel.page';

/**
 * Feature Flag: NEXT_PUBLIC_ENABLE_HUMAN_CHAT
 *
 * Controls the visibility of the Human Chat panel. When set to "true",
 * the panel trigger button and sidebar are rendered. When unset or
 * any other value, only the page children render (no Human Chat panel).
 *
 * Note: This is a NEXT_PUBLIC_ env var, bundled at build time.
 * The "flag disabled" tests require a separate build without the flag.
 */

test.describe('Human Chat Panel — Feature Flag Enabled', () => {
  let chatPanel: HumanChatPanelPage;

  test.use({
    extraHTTPHeaders: { Cookie: 'HYPHA_ENABLE_HUMAN_CHAT=true' },
  });

  test.beforeEach(async ({ page, context }) => {
    await HumanChatPanelPage.enableHumanChat(context);
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

test.describe('Human Chat Panel — Feature Flag Disabled', () => {
  /**
   * These tests verify behavior when NEXT_PUBLIC_ENABLE_HUMAN_CHAT is NOT "true".
   *
   * Since this is a build-time env var bundled by Next.js, toggling it requires
   * a separate build/dev server started without the flag. These tests are skipped
   * in the default test run (which assumes the flag is enabled for development).
   *
   * To run these tests:
   * 1. Start the dev server without the flag: `NEXT_PUBLIC_ENABLE_HUMAN_CHAT= npx nx start web`
   * 2. Run only this describe block: `npx playwright test human-chat-panel-feature-flag --grep "Disabled"`
   *
   * Expected behavior when disabled:
   * - No "Open chat panel" button rendered
   * - No right sidebar/panel markup in the DOM
   * - Page content renders normally without any Human Chat wrapper
   */

  // eslint-disable-next-line playwright/no-skipped-test
  test.skip(
    true,
    'Requires a build without NEXT_PUBLIC_ENABLE_HUMAN_CHAT=true',
  );

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

    // Space page content should still render
    await expect(page.getByText('Agreements')).toBeVisible();
  });
});
