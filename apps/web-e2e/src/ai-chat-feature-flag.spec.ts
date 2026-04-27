import { test, expect } from '@playwright/test';
import { AiChatPanelPage } from './pages/ai-chat-panel.page';
import { gotoApp } from './utils/nav-url';

/**
 * Feature Flag: NEXT_PUBLIC_ENABLE_AI_CHAT
 *
 * Controls the visibility of the AI Chat panel. When set to "true",
 * the panel trigger button and sidebar are rendered. When unset or
 * any other value, only the page children render (no AI panel).
 *
 * Default runtime: off. E2E enables the flag via `HYPHA_ENABLE_AI_CHAT` cookie
 * (see `AiChatPanelPage.enableAiChat`). The "flag disabled" tests require a build
 * where `NEXT_PUBLIC_ENABLE_AI_CHAT` is not "true" for SSR.
 */

test.describe('AI Chat Panel — Feature Flag Enabled', () => {
  let chatPanel: AiChatPanelPage;

  test.beforeEach(async ({ context, page }) => {
    await AiChatPanelPage.enableAiChat(context);
    chatPanel = new AiChatPanelPage(page);
    await chatPanel.open();
  });

  test('should render the AI panel trigger button on a space page', async () => {
    await expect(chatPanel.openButton).toBeVisible();
    await expect(chatPanel.openButton).toHaveAttribute(
      'aria-label',
      /open hypha ai/i,
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
    await gotoApp(page, '/en/my-spaces');
    await page.waitForLoadState('domcontentloaded');

    const aiButton = page.getByRole('button', {
      name: 'Open Hypha AI panel',
    });
    await expect(aiButton).not.toBeVisible();
  });
});

test.describe('AI Chat Panel — Feature Flag Disabled', () => {
  /**
   * These tests verify behavior when NEXT_PUBLIC_ENABLE_AI_CHAT is NOT "true".
   *
   * Since this is a build-time env var bundled by Next.js, toggling it requires
   * a separate build/dev server started without the flag. These tests are skipped
   * in the default test run (which assumes the flag is enabled for development).
   *
   * To run these tests:
   * 1. Start the dev server without the flag: `NEXT_PUBLIC_ENABLE_AI_CHAT= npx nx start web`
   * 2. Run only this describe block: `npx playwright test ai-chat-feature-flag --grep "Disabled"`
   *
   * Expected behavior when disabled:
   * - No "Open Hypha AI panel" button rendered
   * - No sidebar/panel markup in the DOM
   * - Page content renders normally without any AI wrapper
   */

  // eslint-disable-next-line playwright/no-skipped-test
  test.skip(true, 'Requires a build without NEXT_PUBLIC_ENABLE_AI_CHAT=true');

  test('should not render AI trigger button on space page', async ({
    page,
  }) => {
    await gotoApp(page, '/en/dho/hypha');
    await page.waitForLoadState('domcontentloaded');

    const aiButton = page.getByRole('button', {
      name: 'Open Hypha AI panel',
    });
    await expect(aiButton).not.toBeVisible();
  });

  test('should not render sidebar panel markup', async ({ page }) => {
    await gotoApp(page, '/en/dho/hypha');
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar).toHaveCount(0);
  });

  test('should render page content normally', async ({ page }) => {
    await gotoApp(page, '/en/dho/hypha');
    await page.waitForLoadState('domcontentloaded');

    // Space page content should still render
    await expect(page.getByText('Members')).toBeVisible();
    await expect(page.getByText('Agreements')).toBeVisible();
  });
});
