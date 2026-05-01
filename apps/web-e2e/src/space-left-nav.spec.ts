import { test, expect } from '@playwright/test';
import { AiChatPanelPage } from './pages/ai-chat-panel.page';

/**
 * Space navigation in the AI left panel (desktop). Horizontal tabs are hidden from md breakpoint up.
 */
test.describe('Space left navigation', () => {
  test.beforeEach(async ({ context, page }) => {
    await AiChatPanelPage.enableAiChat(context);
    await context.addCookies([
      {
        name: 'HYPHA_ENABLE_COHERENCE',
        value: 'true',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
    await page.goto('/en/dho/hypha/agreements');
    await page.waitForLoadState('domcontentloaded');
  });

  test('opens from Hypha AI and shows primary nav links', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Hypha AI' }).click();

    await expect(page.getByTestId('space-left-nav-proposals')).toBeVisible();
    await expect(page.getByTestId('space-left-nav-members')).toBeVisible();
    await expect(page.getByTestId('space-left-nav-treasury')).toBeVisible();
    await expect(page.getByTestId('space-left-nav-signals')).toBeVisible();
  });

  test('navigates to members when Members is clicked', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Hypha AI' }).click();
    await page.getByTestId('space-left-nav-members').click();
    await expect(page).toHaveURL(/\/en\/dho\/hypha\/members/);
  });

  test('navigates to treasury when Treasury is clicked', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Hypha AI' }).click();
    await page.getByTestId('space-left-nav-treasury').click();
    await expect(page).toHaveURL(/\/en\/dho\/hypha\/treasury/);
  });
});
