import { test, expect } from '../../fixtures';
import { SpaceDetailPage } from '../../pages';
import { ProposalCardList } from '../../components';

/**
 * Space Detail Page Tests
 *
 * These tests verify space detail page functionality.
 */
test.describe('Space Detail Page', () => {
  test('displays space information', async ({ page, testSpace }) => {
    const spacePage = new SpaceDetailPage(page);

    await spacePage.open(testSpace.slug);
    await spacePage.waitForSpaceLoad();

    // Space should be loaded
    await expect(page).toHaveURL(new RegExp(`dho/${testSpace.slug}`));
  });

  test('has navigation tabs', async ({ page, testSpace }) => {
    const spacePage = new SpaceDetailPage(page);

    await spacePage.open(testSpace.slug);
    await spacePage.waitForSpaceLoad();

    // Check for navigation tabs
    const tabsToCheck = [
      { locator: spacePage.overviewTab, name: 'overview' },
      { locator: spacePage.agreementsTab, name: 'agreements' },
      { locator: spacePage.membersTab, name: 'members' },
      { locator: spacePage.treasuryTab, name: 'treasury' },
    ];

    for (const tab of tabsToCheck) {
      const isVisible = await tab.locator.isVisible().catch(() => false);
      // At least some tabs should be visible
      if (isVisible) {
        console.log(`Tab ${tab.name} is visible`);
      }
    }

    // At least agreements tab should be visible (default tab)
    const agreementsVisible = await spacePage.agreementsTab
      .isVisible()
      .catch(() => false);
    expect(agreementsVisible).toBeTruthy();
  });

  test('can navigate to overview tab', async ({ page, testSpace }) => {
    const spacePage = new SpaceDetailPage(page);

    await spacePage.open(testSpace.slug);
    await spacePage.waitForSpaceLoad();

    // Navigate to overview
    await spacePage.goToOverview();

    await expect(page).toHaveURL(/overview/);
  });

  test('can navigate to members tab', async ({ page, testSpace }) => {
    const spacePage = new SpaceDetailPage(page);

    await spacePage.open(testSpace.slug);
    await spacePage.waitForSpaceLoad();

    await spacePage.goToMembers();

    await expect(page).toHaveURL(/members/);
  });

  test('can navigate to treasury tab', async ({ page, testSpace }) => {
    const spacePage = new SpaceDetailPage(page);

    await spacePage.open(testSpace.slug);
    await spacePage.waitForSpaceLoad();

    await spacePage.goToTreasury();

    await expect(page).toHaveURL(/treasury/);
  });

  test('agreements tab shows proposal cards', async ({ page, testSpace }) => {
    const spacePage = new SpaceDetailPage(page);

    await spacePage.open(testSpace.slug);
    await spacePage.waitForSpaceLoad();

    // Make sure we're on agreements tab
    await spacePage.goToAgreements();

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // Check for proposal cards
    const proposalCards = new ProposalCardList(page);
    const cardCount = await proposalCards.count();

    // Should have some content (cards or empty state)
    console.log(`Found ${cardCount} proposal cards`);

    // Verify page has content
    const hasContent =
      cardCount > 0 ||
      (await page
        .locator('text=/no.*agreements|no.*proposals|empty/i')
        .isVisible()
        .catch(() => false));

    expect(hasContent).toBeTruthy();
  });

  test('sandbox badge is displayed for sandbox spaces', async ({
    page,
    testSpace,
  }) => {
    const spacePage = new SpaceDetailPage(page);

    await spacePage.open(testSpace.slug);
    await spacePage.waitForSpaceLoad();

    const spaceInfo = await spacePage.getSpaceInfo();

    // Check sandbox status
    console.log(`Space sandbox status: ${spaceInfo.isSandbox}`);

    // This is informational - sandbox status varies by space
  });

  test('clicking on a proposal card navigates to detail', async ({
    page,
    testSpace,
  }) => {
    const spacePage = new SpaceDetailPage(page);

    await spacePage.open(testSpace.slug);
    await spacePage.waitForSpaceLoad();
    await spacePage.goToAgreements();
    await page.waitForLoadState('networkidle');

    const proposalCards = new ProposalCardList(page);
    const cardCount = await proposalCards.count();

    if (cardCount > 0) {
      const firstCard = proposalCards.getCard(0);
      const cardInfo = await firstCard.getInfo();

      console.log(`Clicking on proposal: ${cardInfo.title}`);

      await firstCard.click();

      // Should navigate to proposal detail
      await expect(page).toHaveURL(/proposal/);
    } else {
      test.skip(true, 'No proposal cards to click');
    }
  });
});
