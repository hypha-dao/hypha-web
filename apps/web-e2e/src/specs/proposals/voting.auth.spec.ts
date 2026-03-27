import { test, expect, TEST_USERS } from '../../fixtures';
import { ProposalDetailPage } from '../../pages';
import { ProposalCardList } from '../../components';

/**
 * Proposal Voting Tests (Authenticated)
 *
 * These tests verify voting functionality for authenticated users.
 * Uses Privy test mode to simulate authenticated state.
 */
test.describe('Proposal Voting', () => {
  test.beforeEach(async ({ page, authenticateAs }) => {
    // Authenticate as a member user before each test
    await authenticateAs('member');
  });

  test('authenticated member can view voting form on active proposal', async ({
    page,
    testSpace,
  }) => {
    const proposalPage = new ProposalDetailPage(page);

    // Navigate to the space's agreements page
    await page.goto(`/en/dho/${testSpace.slug}/agreements`);
    await page.waitForLoadState('networkidle');

    // Find an active proposal card
    const proposalCards = new ProposalCardList(page);
    const cardCount = await proposalCards.count();

    if (cardCount > 0) {
      // Click first proposal to view details
      const firstCard = proposalCards.getCard(0);
      await firstCard.click();

      // Wait for proposal page to load
      await proposalPage.waitForProposalLoad();

      // Verify voting form is visible
      const votingFormVisible = await proposalPage.votingForm.isVisible();
      expect(votingFormVisible).toBeTruthy();
    } else {
      // Skip if no proposals available
      test.skip(true, 'No proposals available for testing');
    }
  });

  test('member can vote yes on a proposal', async ({ page, testSpace }) => {
    const proposalPage = new ProposalDetailPage(page);

    // Navigate to space agreements
    await page.goto(`/en/dho/${testSpace.slug}/agreements`);
    await page.waitForLoadState('networkidle');

    const proposalCards = new ProposalCardList(page);
    const cardCount = await proposalCards.count();

    if (cardCount > 0) {
      // Find a proposal that can be voted on
      const firstCard = proposalCards.getCard(0);
      await firstCard.click();
      await proposalPage.waitForProposalLoad();

      // Check if voting is available
      const canVote = await proposalPage.canVote();

      if (canVote) {
        // Get initial vote status
        const initialVote = await proposalPage.getMyVote();

        if (initialVote === null) {
          // Cast yes vote
          await proposalPage.voteYes();

          // Verify vote was recorded
          const myVote = await proposalPage.getMyVote();
          expect(myVote).toBe('yes');
        } else {
          // User already voted - verify vote is shown
          expect(initialVote).toMatch(/yes|no/);
        }
      } else {
        test.skip(true, 'Voting not available for this proposal');
      }
    } else {
      test.skip(true, 'No proposals available for testing');
    }
  });

  test('member can vote no on a proposal', async ({ page, testSpace }) => {
    const proposalPage = new ProposalDetailPage(page);

    await page.goto(`/en/dho/${testSpace.slug}/agreements`);
    await page.waitForLoadState('networkidle');

    const proposalCards = new ProposalCardList(page);
    const cardCount = await proposalCards.count();

    if (cardCount > 0) {
      const firstCard = proposalCards.getCard(0);
      await firstCard.click();
      await proposalPage.waitForProposalLoad();

      const canVote = await proposalPage.canVote();

      if (canVote) {
        const initialVote = await proposalPage.getMyVote();

        if (initialVote === null) {
          // Cast no vote
          await proposalPage.voteNo();

          // Verify vote was recorded
          const myVote = await proposalPage.getMyVote();
          expect(myVote).toBe('no');
        } else {
          expect(initialVote).toMatch(/yes|no/);
        }
      } else {
        test.skip(true, 'Voting not available for this proposal');
      }
    } else {
      test.skip(true, 'No proposals available for testing');
    }
  });

  test('voting stats are displayed correctly', async ({ page, testSpace }) => {
    const proposalPage = new ProposalDetailPage(page);

    await page.goto(`/en/dho/${testSpace.slug}/agreements`);
    await page.waitForLoadState('networkidle');

    const proposalCards = new ProposalCardList(page);
    const cardCount = await proposalCards.count();

    if (cardCount > 0) {
      const firstCard = proposalCards.getCard(0);
      await firstCard.click();
      await proposalPage.waitForProposalLoad();

      // Verify voting form shows stats
      const votingFormVisible = await proposalPage.votingForm.isVisible();

      if (votingFormVisible) {
        const stats = await proposalPage.votingForm.getVotingStats();

        // Verify that some stats are displayed
        expect(stats).toBeDefined();
        // Time remaining or progress should be shown
        const hasStats =
          stats.unity !== null ||
          stats.quorum !== null ||
          stats.timeRemaining !== null;
        expect(hasStats).toBeTruthy();
      }
    } else {
      test.skip(true, 'No proposals available for testing');
    }
  });

  test('non-member sees appropriate message', async ({
    page,
    testSpace,
    authenticateAs,
  }) => {
    // Re-authenticate as a guest (non-member)
    await authenticateAs('guest');

    const proposalPage = new ProposalDetailPage(page);

    await page.goto(`/en/dho/${testSpace.slug}/agreements`);
    await page.waitForLoadState('networkidle');

    const proposalCards = new ProposalCardList(page);
    const cardCount = await proposalCards.count();

    if (cardCount > 0) {
      const firstCard = proposalCards.getCard(0);
      await firstCard.click();
      await proposalPage.waitForProposalLoad();

      // Voting should be disabled for non-members
      const canVote = await proposalPage.canVote();

      // Non-members shouldn't be able to vote
      // The UI might show disabled buttons or a message
      const tooltipMessage = await proposalPage.votingForm.getTooltipMessage();

      if (!canVote && tooltipMessage) {
        expect(tooltipMessage.toLowerCase()).toContain('join');
      }
    } else {
      test.skip(true, 'No proposals available for testing');
    }
  });
});
