import { test, expect } from '@playwright/test';
import { HumanChatPanelPage } from './pages/human-chat-panel.page';

/**
 * Human Chat Panel — Space-specific chat state.
 *
 * The Human Chat panel should be space-specific:
 * - Each space gets its own chat room
 * - Navigating to a different space resets the chat (clears messages, input)
 * - Navigating back to the original space re-joins its room
 *
 */
test.describe('Human Chat Panel — Space Switching', () => {
  test.setTimeout(60_000); // Space navigation can be slow in production builds
  const SPACE_A = 'hypha';
  const SPACE_B = 'hypha-platform';

  let chatPanel: HumanChatPanelPage;

  test('should show welcome message on a fresh space', async ({ page }) => {
    chatPanel = new HumanChatPanelPage(page);
    await chatPanel.open(SPACE_A);
    await chatPanel.openPanel();
    await expect(chatPanel.welcomeMessage).toBeVisible();
  });

  test('should reset chat state when navigating to a different space', async ({
    page,
  }) => {
    chatPanel = new HumanChatPanelPage(page);

    // Open panel on space A and type something
    await chatPanel.open(SPACE_A);
    await chatPanel.openPanel();
    await chatPanel.chatInput.fill('Draft message for space A');
    await expect(chatPanel.chatInput).toHaveValue('Draft message for space A');

    // Navigate to space B
    await chatPanel.navigateToSpace(SPACE_B);

    // Panel should reset — input should be cleared
    // The open button should be visible (panel may close on navigation)
    // Re-open and verify fresh state
    await chatPanel.openPanel();
    await expect(chatPanel.chatInput).toHaveValue('');
    await expect(chatPanel.welcomeMessage).toBeVisible();
  });

  test('should show different chat state per space', async ({ page }) => {
    chatPanel = new HumanChatPanelPage(page);

    // Visit space A and open panel
    await chatPanel.open(SPACE_A);
    await chatPanel.openPanel();
    await expect(chatPanel.welcomeMessage).toBeVisible();

    // Visit space B and open panel
    await chatPanel.navigateToSpace(SPACE_B);
    await chatPanel.openPanel();
    await expect(chatPanel.welcomeMessage).toBeVisible();

    // Chat bar should be empty on the new space
    await expect(chatPanel.chatInput).toHaveValue('');
  });

  test('should clear input when switching spaces', async ({ page }) => {
    chatPanel = new HumanChatPanelPage(page);

    // Open panel on space A, type in input
    await chatPanel.open(SPACE_A);
    await chatPanel.openPanel();
    await chatPanel.chatInput.fill('Hello space A');

    // Navigate to space B
    await chatPanel.navigateToSpace(SPACE_B);
    await chatPanel.openPanel();

    // Input should be empty — no carry-over from space A
    await expect(chatPanel.chatInput).toHaveValue('');
  });

  test('should have send button disabled on fresh space (empty input)', async ({
    page,
  }) => {
    chatPanel = new HumanChatPanelPage(page);
    await chatPanel.open(SPACE_A);
    await chatPanel.openPanel();
    await expect(chatPanel.sendButton).toBeDisabled();

    // Navigate to space B
    await chatPanel.navigateToSpace(SPACE_B);
    await chatPanel.openPanel();
    await expect(chatPanel.sendButton).toBeDisabled();
  });
});
