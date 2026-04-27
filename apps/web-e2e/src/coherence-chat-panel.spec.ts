/**
 * E2E tests for the Coherence Chat → Human Right Panel integration.
 *
 * Written TDD-style — tests are written before implementation to drive
 * the architecture defined in docs/plans/coherence-chat-panel-plan.md.
 *
 * ## Feature Summary
 * Clicking a signal card on the coherence page opens the Human Right Panel
 * in "coherence mode" — loading that signal's Matrix room in the sidebar
 * instead of navigating to an @aside route. Clicking "back" or closing the
 * panel returns to "space chat" mode.
 *
 * ## Architecture (Step references from docs/plans/coherence-chat-panel-plan.md)
 * - Step 1: HumanChatPanelContext extended with mode + coherence fields
 * - Step 2: HumanRightPanel dual-mode room logic (space | coherence)
 * - Step 3: HumanChatPanelHeader back button (ArrowLeft + aria-label)
 * - Step 4: SignalCard onOpenConversation prop
 * - Step 5: SignalGrid/SignalSection onSignalClick threading
 * - Step 6: CoherenceBlock wires openCoherenceChat + sidebar.setOpen
 *
 * ## Test Status
 * - Panel baseline: passes without auth (panel trigger is always visible)
 * - All other sections: fixme — require authenticated signal cards
 *   TODO: Add auth fixture (JWT/cookie) and remove fixme.
 *
 * ## Data-testids added by implementation
 * - signal-grid: <button data-testid="signal-card-button"> wraps each active signal
 */

import { test, expect } from '@playwright/test';
import { CoherenceChatPanelPage } from './pages/coherence-chat-panel.page';
import { HumanChatPanelPage } from './pages/human-chat-panel.page';
import { gotoApp } from './utils/nav-url';

test.describe('Coherence Chat Panel Integration', () => {
  const SPACE_SLUG = 'hypha';

  // ─────────────────────────────────────────────────────────────────────────
  // Panel Baseline (unauthenticated)
  //
  // These tests verify that the Human Right Panel trigger is accessible from
  // the coherence page regardless of authentication state. They serve as a
  // baseline to confirm the panel infrastructure is in place.
  // ─────────────────────────────────────────────────────────────────────────
  test.describe('Panel Baseline (unauthenticated)', () => {
    test('human chat panel trigger button is visible on coherence page', async ({
      page,
    }) => {
      const chatPanel = new HumanChatPanelPage(page);
      await gotoApp(page, `/en/dho/${SPACE_SLUG}/coherence`);
      await page.waitForLoadState('domcontentloaded');

      await expect(chatPanel.openButton).toBeVisible();
      await expect(chatPanel.openButton).toHaveAttribute(
        'aria-label',
        /open chat panel/i,
      );
    });

    test('panel opens in space chat mode by default from coherence page', async ({
      page,
    }) => {
      const chatPanel = new HumanChatPanelPage(page);
      await gotoApp(page, `/en/dho/${SPACE_SLUG}/coherence`);
      await page.waitForLoadState('domcontentloaded');
      await chatPanel.openPanel();

      // In space mode, header shows the default "Chat" title
      await expect(chatPanel.headerText).toBeVisible();
      await expect(chatPanel.closeButton).toBeVisible();
    });

    test('panel in space mode has no back button (hash icon is shown)', async ({
      page,
    }) => {
      const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
      await gotoApp(page, `/en/dho/${SPACE_SLUG}/coherence`);
      await page.waitForLoadState('domcontentloaded');
      // Open button exists; back button should NOT be present in space mode
      await chatPanel.openPanelButton.click();

      await expect(chatPanel.backButton).not.toBeVisible();
    });

    test('space chat panel has functional chat input and send button', async ({
      page,
    }) => {
      const chatPanel = new HumanChatPanelPage(page);
      await gotoApp(page, `/en/dho/${SPACE_SLUG}/coherence`);
      await page.waitForLoadState('domcontentloaded');
      await chatPanel.openPanel();

      await expect(chatPanel.chatInput).toBeVisible();
      await expect(chatPanel.sendButton).toBeVisible();
      await expect(chatPanel.sendButton).toBeDisabled(); // empty input
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Signal Card → Panel Interaction (authenticated)
  //
  // Tests that verify clicking a signal card opens the panel in coherence
  // mode WITHOUT navigating away from the coherence page.
  //
  // Requires: authenticated session with signal cards visible.
  // TODO: Add auth fixture (JWT/cookie) and remove fixme.
  // ─────────────────────────────────────────────────────────────────────────
  test.describe('Signal Card → Panel Interaction (authenticated)', () => {
    test.fixme(
      'clicking a signal card opens the right panel',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        // Signal cards should be visible (authenticated)
        await expect(chatPanel.firstSignalCard).toBeVisible();

        // Click the first signal card button
        await chatPanel.firstSignalCard.click();

        // Panel should open (sidebar becomes visible)
        await expect(chatPanel.panelSidebar).toBeVisible();
      },
    );

    test.fixme(
      'clicking a signal card does NOT navigate away from coherence page',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        await chatPanel.firstSignalCard.click();

        // URL must remain on the coherence page — no navigation to /chat/:slug
        await expect(page).toHaveURL(
          new RegExp(`/en/dho/${SPACE_SLUG}/coherence$`),
        );
      },
    );

    test.fixme(
      '"Open conversation" button on signal card opens the panel in coherence mode',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        // Click the "Open conversation" button inside the first signal card
        await chatPanel.firstOpenConversationButton.click();

        // Panel should be open in coherence mode (back button visible)
        await expect(chatPanel.panelSidebar).toBeVisible();
        await expect(chatPanel.backButton).toBeVisible();
      },
    );

    test.fixme(
      'signal card is rendered as a button (not a link) when onSignalClick is wired',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        // Signal cards should be <button> elements, not <a> links (Step 5 of plan)
        const firstCard = chatPanel.firstSignalCard;
        await expect(firstCard).toBeVisible();
        // Verify it's a button element (not a link)
        const tagName = await firstCard.evaluate((el) =>
          el.tagName.toLowerCase(),
        );
        expect(tagName).toBe('button');
      },
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Panel in Coherence Mode (authenticated)
  //
  // Tests for the panel UI state when a signal is selected:
  // - Header shows conversation title + back button
  // - Messages area renders (loading state or content)
  // - Chat bar is functional
  //
  // Requires: authenticated session with signal cards visible.
  // TODO: Add auth fixture (JWT/cookie) and remove fixme.
  // ─────────────────────────────────────────────────────────────────────────
  test.describe('Panel in Coherence Mode (authenticated)', () => {
    test.fixme(
      'panel header shows the signal conversation title in coherence mode',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        // Get the title of the first signal before clicking
        const signalTitle = await chatPanel.getFirstSignalTitle();
        expect(signalTitle.length).toBeGreaterThan(0);

        // Click the signal card to open coherence mode
        await chatPanel.firstSignalCard.click();
        await chatPanel.waitForCoherenceMode();

        // Panel header title should match the signal's title
        await expect(chatPanel.panelHeaderTitle).toHaveText(signalTitle);
      },
    );

    test.fixme(
      'panel header shows ArrowLeft back button in coherence mode',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        await chatPanel.firstSignalCard.click();
        await chatPanel.waitForCoherenceMode();

        // Back button should be visible (replaces Hash icon in space mode)
        await expect(chatPanel.backButton).toBeVisible();
      },
    );

    test.fixme(
      'panel header does not show default "Chat" title in coherence mode',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        await chatPanel.firstSignalCard.click();
        await chatPanel.waitForCoherenceMode();

        // Title should be the conversation name, NOT the generic "Chat" label
        await expect(chatPanel.panelHeaderTitle).not.toHaveText('Chat');
      },
    );

    test.fixme(
      'panel messages area is visible in coherence mode',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        await chatPanel.firstSignalCard.click();
        await chatPanel.waitForCoherenceMode();

        // Messages area (SidebarContent) should be rendered
        await expect(chatPanel.panelMessagesArea).toBeVisible();
      },
    );

    test.fixme('chat input is visible in coherence mode', async ({ page }) => {
      const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
      await chatPanel.openCoherencePage();

      await chatPanel.firstSignalCard.click();
      await chatPanel.waitForCoherenceMode();

      // Chat input and send button should be available in coherence mode
      await expect(chatPanel.chatInput).toBeVisible();
      await expect(chatPanel.sendButton).toBeVisible();
    });

    test.fixme(
      'send button is disabled when chat input is empty in coherence mode',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        await chatPanel.firstSignalCard.click();
        await chatPanel.waitForCoherenceMode();

        await expect(chatPanel.chatInput).toHaveValue('');
        await expect(chatPanel.sendButton).toBeDisabled();
      },
    );

    test.fixme(
      'send button is enabled after typing in chat input in coherence mode',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        await chatPanel.firstSignalCard.click();
        await chatPanel.waitForCoherenceMode();

        await chatPanel.chatInput.fill('Hello coherence chat!');
        await expect(chatPanel.sendButton).not.toBeDisabled();
      },
    );

    test.fixme(
      'chat input does not clear when send button is clicked without auth (no roomId)',
      async ({ page }) => {
        // Without Matrix auth, handleSend early-returns (no roomId), input preserved.
        // This mirrors the existing space chat pattern.
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        await chatPanel.firstSignalCard.click();
        await chatPanel.waitForCoherenceMode();

        await chatPanel.chatInput.fill('Test coherence message');
        await chatPanel.sendButton.click();

        // Input should be preserved — no Matrix room joined (unauthenticated Matrix)
        await expect(chatPanel.chatInput).toHaveValue('Test coherence message');
      },
    );

    test.fixme(
      'panel shows loading state while joining coherence room',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        await chatPanel.firstSignalCard.click();
        await chatPanel.waitForCoherenceMode();

        // Loading text from i18n HumanChatPanel.loading ("Loading...")
        // OR messages area — either is acceptable
        const loadingText = page.getByText('Loading...', { exact: false });
        const messagesArea = chatPanel.panelMessagesArea;

        const loadingVisible = await loadingText.isVisible();
        const messagesVisible = await messagesArea.isVisible();

        expect(loadingVisible || messagesVisible).toBeTruthy();
      },
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Back Navigation and Panel Close (authenticated)
  //
  // Tests for the "back" interaction and panel close behavior:
  // - Clicking back returns to space chat mode
  // - Closing panel resets to space chat mode (on re-open)
  // - Space chat is preserved when cycling through coherence mode
  //
  // Requires: authenticated session with signal cards visible.
  // TODO: Add auth fixture (JWT/cookie) and remove fixme.
  // ─────────────────────────────────────────────────────────────────────────
  test.describe('Back Navigation and Panel Close (authenticated)', () => {
    test.fixme(
      'clicking back button returns panel to space chat mode',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        // Enter coherence mode
        await chatPanel.firstSignalCard.click();
        await chatPanel.waitForCoherenceMode();
        await expect(chatPanel.backButton).toBeVisible();

        // Click back
        await chatPanel.backButton.click();
        await chatPanel.waitForSpaceMode();

        // Should be back in space mode — "Chat" title, no back button
        await expect(chatPanel.panelHeaderTitle).toHaveText('Chat');
        await expect(chatPanel.backButton).not.toBeVisible();
      },
    );

    test.fixme(
      'closing panel via close button resets to space chat mode on re-open',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        // Enter coherence mode
        await chatPanel.firstSignalCard.click();
        await chatPanel.waitForCoherenceMode();

        // Close the panel
        await chatPanel.closeButton.click();

        // Re-open the panel — should be in space chat mode (mode reset on close)
        await chatPanel.openPanelButton.click();

        await expect(chatPanel.panelHeaderTitle).toHaveText('Chat');
        await expect(chatPanel.backButton).not.toBeVisible();
      },
    );

    test.fixme(
      'clicking a different signal replaces the previous coherence room in the panel',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        // Click the first signal
        const firstTitle = await chatPanel.getFirstSignalTitle();
        await chatPanel.firstSignalCard.click();
        await chatPanel.waitForCoherenceMode();
        await expect(chatPanel.panelHeaderTitle).toHaveText(firstTitle);

        // Go back to coherence page
        await chatPanel.backButton.click();
        await chatPanel.waitForSpaceMode();

        // Click the second signal
        const secondTitle = await chatPanel.getSecondSignalTitle();
        await chatPanel.secondSignalCard.click();
        await chatPanel.waitForCoherenceMode();

        // Panel should now show second signal's title
        await expect(chatPanel.panelHeaderTitle).toHaveText(secondTitle);
        expect(secondTitle).not.toBe(firstTitle);
      },
    );

    test.fixme(
      'panel remains open after clicking back (does not close)',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        await chatPanel.firstSignalCard.click();
        await chatPanel.waitForCoherenceMode();

        // Click back — panel should remain visible (not closed)
        await chatPanel.backButton.click();
        await chatPanel.waitForSpaceMode();

        // Close button still present = panel is still open
        await expect(chatPanel.closeButton).toBeVisible();
        await expect(chatPanel.chatInput).toBeVisible();
      },
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Space Chat Preservation (authenticated)
  //
  // Verifies that opening a coherence signal does not break the default
  // "space chat" mode — it remains accessible by going back or re-opening
  // the panel after closing.
  //
  // Requires: authenticated session with signal cards visible.
  // TODO: Add auth fixture (JWT/cookie) and remove fixme.
  // ─────────────────────────────────────────────────────────────────────────
  test.describe('Space Chat Preservation (authenticated)', () => {
    test.fixme(
      'space chat mode is the default state of the panel on coherence page',
      async ({ page }) => {
        const chatPanel = new HumanChatPanelPage(page);
        await gotoApp(page, `/en/dho/${SPACE_SLUG}/coherence`);
        await page.waitForLoadState('domcontentloaded');

        await chatPanel.openPanel();

        // Default mode should be space chat — "Chat" header title, no back button
        await expect(chatPanel.headerText).toBeVisible();
      },
    );

    test.fixme(
      'navigating to coherence from another route preserves space chat mode',
      async ({ page }) => {
        const chatPanel = new HumanChatPanelPage(page);

        // Start on agreements page (default space chat)
        await chatPanel.open(SPACE_SLUG);
        await chatPanel.openPanel();
        await expect(chatPanel.headerText).toBeVisible(); // "Chat"

        // Navigate to coherence page
        await gotoApp(page, `/en/dho/${SPACE_SLUG}/coherence`);
        await page.waitForLoadState('domcontentloaded');

        // Panel should still be in space chat mode (no signal was clicked)
        await expect(chatPanel.headerText).toBeVisible();
      },
    );

    test.fixme(
      'closing coherence mode and reopening panel shows space chat (welcome message)',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        // Enter and exit coherence mode
        await chatPanel.firstSignalCard.click();
        await chatPanel.waitForCoherenceMode();
        await chatPanel.closeButton.click();

        // Re-open panel — should show welcome / space chat
        await chatPanel.openPanelButton.click();
        await expect(chatPanel.panelHeaderTitle).toHaveText('Chat');
      },
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge Cases (authenticated)
  //
  // Requires: authenticated session with signal cards visible.
  // TODO: Add auth fixture (JWT/cookie) and remove fixme.
  // ─────────────────────────────────────────────────────────────────────────
  test.describe('Edge Cases (authenticated)', () => {
    test.fixme(
      'signal without roomId has disabled "Open conversation" button',
      async ({ page }) => {
        // From Step 4 of plan: disable button when !roomId
        // (new signals may not have a room created yet)
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        // Find a signal card where roomId is null/undefined
        // In the UI this shows as a disabled "Open conversation" button
        const disabledButton = page
          .locator('[data-testid="signal-card-button"]')
          .getByRole('button', { name: /open conversation/i })
          .filter({ hasNot: page.locator(':not([disabled])') });

        // If such a card exists, the button should be disabled
        if ((await disabledButton.count()) > 0) {
          await expect(disabledButton.first()).toBeDisabled();
        }
      },
    );

    test.fixme(
      'archived signal card does not have a button wrapper (no panel open)',
      async ({ page }) => {
        // Archived signals are NOT wrapped in <button> — they have the unarchive dialog instead.
        // Clicking an archived card should NOT open the panel.
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        // Archived cards render an "Unarchive" button, not "Open conversation"
        const archivedCard = page.getByRole('button', { name: /unarchive/i });

        if ((await archivedCard.count()) > 0) {
          // Archived card button click should show confirm dialog, not open panel
          await archivedCard.first().click();
          // Confirm dialog should appear, panel should NOT open in coherence mode
          await expect(
            page.getByRole('dialog').filter({ hasText: /unarchive/i }),
          ).toBeVisible();
          await expect(chatPanel.backButton).not.toBeVisible();
        }
      },
    );

    test.fixme(
      'panel stays in coherence mode when scrolling the coherence page',
      async ({ page }) => {
        const chatPanel = new CoherenceChatPanelPage(page, SPACE_SLUG);
        await chatPanel.openCoherencePage();

        await chatPanel.firstSignalCard.click();
        await chatPanel.waitForCoherenceMode();

        // Scroll the page
        await page.evaluate(() => window.scrollBy(0, 500));

        // Panel should still be in coherence mode
        await expect(chatPanel.backButton).toBeVisible();
      },
    );
  });
});
