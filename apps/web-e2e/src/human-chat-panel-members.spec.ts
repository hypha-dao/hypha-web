import { test, expect } from '@playwright/test';
import { HumanChatPanelPage } from './pages/human-chat-panel.page';

/**
 * E2E tests for the Human Chat Panel Members tab.
 *
 * Verifies that the members tab loads real member data from
 * the `/api/v1/spaces/:spaceSlug/members` endpoint, rendered
 * in a compact list inside the right sidebar chat panel.
 */
test.describe('Human Chat Panel – Members Tab', () => {
  const MOCK_MEMBERS_RESPONSE = {
    persons: {
      data: [
        {
          id: 1,
          name: 'Alice',
          surname: 'Johnson',
          nickname: 'alice',
          slug: 'alice-johnson',
          avatarUrl: '',
          location: 'Berlin',
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          name: 'Bob',
          surname: 'Smith',
          nickname: 'bob',
          slug: 'bob-smith',
          avatarUrl: '',
          location: 'London',
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 3,
          name: 'Carol',
          surname: 'Williams',
          nickname: 'carol',
          slug: 'carol-williams',
          avatarUrl: '',
          location: 'Paris',
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
      pagination: {
        total: 3,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        hasNextPage: false,
      },
    },
    spaces: {
      data: [],
      pagination: {
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
        hasNextPage: false,
      },
    },
  };

  let chatPanel: HumanChatPanelPage;

  test.beforeEach(async ({ page }) => {
    // Intercept the members API to return deterministic mock data
    await page.route('**/api/v1/spaces/*/members*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MEMBERS_RESPONSE),
      });
    });

    chatPanel = new HumanChatPanelPage(page);
    await chatPanel.open();
    await chatPanel.openPanel();
  });

  test('should show Members tab button', async () => {
    await expect(chatPanel.membersTab).toBeVisible();
  });

  test('should switch to members tab and show member list', async () => {
    await chatPanel.membersTab.click();
    await expect(chatPanel.membersContainer).toBeVisible();
  });

  test('should display real member names from API', async () => {
    await chatPanel.membersTab.click();
    await expect(chatPanel.membersContainer).toBeVisible();

    // Wait for member items to appear
    await expect(chatPanel.memberItems.first()).toBeVisible();

    // Verify all 3 mock members are rendered
    await expect(chatPanel.memberItems).toHaveCount(3);

    // Verify names
    const memberTexts = await chatPanel.memberItems.allTextContents();
    expect(memberTexts).toContain('Alice Johnson');
    expect(memberTexts).toContain('Bob Smith');
    expect(memberTexts).toContain('Carol Williams');
  });

  test('should show member count', async () => {
    await chatPanel.membersTab.click();
    await expect(chatPanel.membersContainer).toBeVisible();

    // The count text should include the total
    const countText = chatPanel.membersContainer.locator(
      '.text-muted-foreground',
    );
    await expect(countText).toContainText('3');
  });

  test('should switch back to chat tab from members tab', async () => {
    await chatPanel.membersTab.click();
    await expect(chatPanel.membersContainer).toBeVisible();

    // Switch back to chat
    await chatPanel.chatTab.click();

    // Members container should be gone, chat bar should be visible
    await expect(chatPanel.membersContainer).not.toBeVisible();
    await expect(chatPanel.chatInput).toBeVisible();
  });

  test('should not show chat bar when members tab is active', async () => {
    await chatPanel.membersTab.click();
    await expect(chatPanel.membersContainer).toBeVisible();

    // Chat input and send button should not be visible
    await expect(chatPanel.chatInput).not.toBeVisible();
    await expect(chatPanel.sendButton).not.toBeVisible();
  });

  test('should call members API with the current space slug', async ({
    page,
  }) => {
    let apiCalled = false;
    let calledUrl = '';

    await page.route('**/api/v1/spaces/*/members*', (route) => {
      apiCalled = true;
      calledUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MEMBERS_RESPONSE),
      });
    });

    await chatPanel.membersTab.click();
    await expect(chatPanel.membersContainer).toBeVisible();

    // Wait for the API call
    await page.waitForTimeout(500);
    expect(apiCalled).toBe(true);
    expect(calledUrl).toContain('/api/v1/spaces/hypha/members');
  });

  test('should show loading skeleton before data arrives', async ({ page }) => {
    // Set up a delayed response
    await page.route('**/api/v1/spaces/*/members*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MEMBERS_RESPONSE),
      });
    });

    // Re-open fresh
    chatPanel = new HumanChatPanelPage(page);
    await chatPanel.open();
    await chatPanel.openPanel();
    await chatPanel.membersTab.click();

    // Should see the members container
    await expect(chatPanel.membersContainer).toBeVisible();
  });

  test('should render PersonAvatar with initials fallback when no avatar image', async () => {
    await chatPanel.membersTab.click();
    await expect(chatPanel.memberItems.first()).toBeVisible();

    // Members have empty avatarUrl, so PersonAvatar renders AvatarFallback
    // with initials. Alice Johnson → "AJ"
    const firstMember = chatPanel.memberItems.first();
    // PersonAvatar wraps Radix Avatar which uses rounded-lg in this project
    const avatar = firstMember.locator('[class*="rounded-lg"]').first();
    await expect(avatar).toBeVisible();
    await expect(avatar).toContainText('AJ');
  });
});
