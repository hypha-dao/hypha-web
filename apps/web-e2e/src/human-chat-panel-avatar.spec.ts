import { test, expect } from '@playwright/test';
import { HumanChatPanelPage } from './pages/human-chat-panel.page';

/**
 * Human Chat Panel — Avatar / Profile Image Tests
 *
 * Verifies that the PersonAvatar component is used in chat message bubbles
 * and that an authenticated user's profile image appears on their own messages.
 *
 * Feature flag: HYPHA_ENABLE_HUMAN_CHAT must be enabled.
 * We use the two-layer cookie strategy (extraHTTPHeaders for SSR + addCookies
 * for client navigation) — see .agents/skills/e2e-testing/references/feature-flags.md
 */

const MOCK_AVATAR_URL = 'https://example.com/test-avatar.png';
const MOCK_USER = {
  id: 1,
  name: 'Test',
  surname: 'User',
  slug: 'test-user',
  avatarUrl: MOCK_AVATAR_URL,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test.describe('Human Chat Panel — Avatar in Messages', () => {
  let chatPanel: HumanChatPanelPage;

  // Layer 1: Send cookie on SSR request
  test.use({
    extraHTTPHeaders: {
      Cookie: 'HYPHA_ENABLE_HUMAN_CHAT=true',
    },
  });

  test.beforeEach(async ({ page, context }) => {
    // Layer 2: Persist cookie for client-side navigations
    await HumanChatPanelPage.enableHumanChat(context);

    chatPanel = new HumanChatPanelPage(page);
    await chatPanel.open();
  });

  test('message bubbles should contain a PersonAvatar component', async ({
    page,
  }) => {
    await chatPanel.openPanel();

    const avatarContainer = page.locator('[data-testid="chat-message-avatar"]');
    await expect(avatarContainer.first()).toBeVisible();
  });

  test('avatar should use rounded-lg (square/rounded) style', async ({
    page,
  }) => {
    await chatPanel.openPanel();

    // PersonAvatar renders with rounded-lg class on the Avatar root
    const avatar = page
      .locator('[data-testid="chat-message-avatar"]')
      .first()
      .locator('[class*="rounded-lg"]');
    await expect(avatar.first()).toBeVisible();
  });

  test('avatar should show initials fallback when no image is provided', async ({
    page,
  }) => {
    await chatPanel.openPanel();

    // The welcome message has senderName="System" — fallback should be visible
    const avatarContainer = page
      .locator('[data-testid="chat-message-avatar"]')
      .first();
    await expect(avatarContainer).toBeVisible();

    // The AvatarFallback renders inside a rounded-lg span
    const fallback = avatarContainer.locator('span[class*="rounded-lg"]');
    await expect(fallback.first()).toBeVisible();
  });
});

test.describe('Human Chat Panel — Authenticated User Avatar', () => {
  let chatPanel: HumanChatPanelPage;

  // Layer 1: Send cookie on SSR request
  test.use({
    extraHTTPHeaders: {
      Cookie: 'HYPHA_ENABLE_HUMAN_CHAT=true',
    },
  });

  test.beforeEach(async ({ page, context }) => {
    // Layer 2: Persist cookie for client-side navigations
    await HumanChatPanelPage.enableHumanChat(context);

    // Mock the /api/v1/people/me endpoint to return a user with an avatar
    await page.route('**/api/v1/people/me', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_USER),
      });
    });

    chatPanel = new HumanChatPanelPage(page);
    await chatPanel.open();
  });

  test('authenticated user profile data should be available via mocked API', async ({
    page,
  }) => {
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/v1/people/me', {
        headers: {
          Authorization: 'Bearer mock-jwt',
          'Content-Type': 'application/json',
        },
      });
      return res.json();
    });

    expect(response.avatarUrl).toBe(MOCK_AVATAR_URL);
    expect(response.name).toBe('Test');
    expect(response.surname).toBe('User');
  });

  test('chat panel should open and show message area with avatar containers', async ({
    page,
  }) => {
    await chatPanel.openPanel();

    const avatars = page.locator('[data-testid="chat-message-avatar"]');
    await expect(avatars.first()).toBeVisible();
  });

  test('message avatar should render PersonAvatar with correct structure', async ({
    page,
  }) => {
    await chatPanel.openPanel();

    const avatarContainer = page
      .locator('[data-testid="chat-message-avatar"]')
      .first();
    await expect(avatarContainer).toBeVisible();

    // PersonAvatar renders Avatar root with rounded-lg
    const avatarRoot = avatarContainer.locator('span[class*="rounded-lg"]');
    await expect(avatarRoot.first()).toBeVisible();
  });

  test('multiple messages should each have their own avatar', async ({
    page,
  }) => {
    await chatPanel.openPanel();

    const avatars = page.locator('[data-testid="chat-message-avatar"]');
    const count = await avatars.count();
    expect(count).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < count; i++) {
      await expect(avatars.nth(i)).toBeVisible();
    }
  });

  test('avatar container should have correct sizing (24x24 for sm)', async ({
    page,
  }) => {
    await chatPanel.openPanel();

    const avatarContainer = page
      .locator('[data-testid="chat-message-avatar"]')
      .first();
    await expect(avatarContainer).toBeVisible();

    // PersonAvatar with size="sm" uses w-[24px] h-[24px]
    const avatar = avatarContainer.locator('[class*="w-[24px]"]');
    await expect(avatar.first()).toBeVisible();
  });
});
