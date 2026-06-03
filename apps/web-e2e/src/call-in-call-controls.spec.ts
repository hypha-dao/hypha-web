import { test, expect, type Page } from '@playwright/test';
import { HumanChatPanelPage } from './pages/human-chat-panel.page';
import { gotoApp } from './utils/nav-url';

const HUMAN_CHAT_COOKIE = 'HYPHA_ENABLE_HUMAN_CHAT=true';
const SPACE_A = 'hypha';
const E2E_HARNESS_PATH = '/en/e2e/call-controls';

async function openSpaceChat(page: Page, spaceSlug: string) {
  const chatPanel = new HumanChatPanelPage(page);
  await gotoApp(page, `/en/dho/${spaceSlug}/coherence`);
  await page.waitForLoadState('domcontentloaded');
  await chatPanel.openPanel();
}

test.describe('Call in-call controls — react popover (WCUX-REACT-4)', () => {
  test.setTimeout(60_000);

  test('dev harness opens popover with quick reactions and raise hand toggle', async ({
    page,
  }) => {
    await gotoApp(page, E2E_HARNESS_PATH);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('e2e-call-controls-harness')).toBeVisible();

    const trigger = page.getByTestId('call-react-trigger');
    await expect(trigger).toBeVisible();
    await trigger.click();

    const popover = page.getByTestId('call-react-popover-content');
    await expect(popover).toBeVisible();
    await expect(popover.getByText('Quick reactions')).toBeVisible();

    const raiseHand = page.getByTestId('call-raise-hand-button');
    await expect(raiseHand).toBeVisible();
    await expect(raiseHand).toHaveText(/Raise hand/i);

    await raiseHand.click();
    await expect(raiseHand).toHaveText(/Lower hand/i);

    await expect(
      popover.getByRole('button', { name: /Send 👍 reaction/i }),
    ).toBeVisible();
  });

  test.describe('live call chrome', () => {
    test.use({
      extraHTTPHeaders: {
        Cookie: HUMAN_CHAT_COOKIE,
      },
    });

    test.beforeEach(async ({ context, baseURL }) => {
      await HumanChatPanelPage.enableHumanChat(context, baseURL);
    });

    test('react trigger is hidden when no call is active', async ({ page }) => {
      await openSpaceChat(page, SPACE_A);
      await expect(page.getByTestId('global-call-dock')).toHaveCount(0);
      await expect(page.getByTestId('call-react-trigger')).toHaveCount(0);
    });

    test.fixme(
      'react popover in global call dock after connected call (needs auth + Matrix fixture)',
      async ({ page }) => {
        await openSpaceChat(page, SPACE_A);

        const panel = page.locator(
          '[data-side="right"] [data-sidebar="sidebar"]',
        );
        await panel
          .getByRole('button', { name: /start video call in this space/i })
          .click();

        const dock = page.getByTestId('global-call-dock');
        await expect(dock).toBeVisible({ timeout: 60_000 });

        const trigger = dock.getByTestId('call-react-trigger');
        await expect(trigger).toBeVisible({ timeout: 60_000 });
        await trigger.click();
        await expect(
          page.getByTestId('call-react-popover-content'),
        ).toBeVisible();
        await expect(page.getByTestId('call-raise-hand-button')).toBeVisible();
      },
    );
  });
});
