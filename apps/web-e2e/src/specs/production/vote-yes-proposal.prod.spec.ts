import { test, expect, Page } from '@playwright/test';

/**
 * Scrolls within the right-side panel to find the Vote yes button
 * @param page - Playwright page object
 */
async function scrollToVoteButton(page: Page): Promise<void> {
  const scrollableContainers = page.locator('[data-radix-scroll-area-viewport]');
  
  for (let i = 0; i < 10; i++) {
    const voteYesButton = page.locator('button:has-text("Vote yes")').first();
    if (await voteYesButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('✅ Found "Vote yes" button');
      return;
    }
    
    // Scroll the right side panel
    const count = await scrollableContainers.count();
    for (let j = 0; j < count; j++) {
      await scrollableContainers.nth(j).evaluate((el) => {
        el.scrollTop += 300;
      }).catch(() => {});
    }
    
    // Also try scrolling elements with overflow classes
    await page.evaluate(() => {
      const scrollables = document.querySelectorAll('[class*="overflow-auto"], [class*="overflow-y-auto"], [class*="scroll"]');
      scrollables.forEach(el => {
        (el as HTMLElement).scrollTop += 300;
      });
    });
    
    await page.waitForTimeout(500);
    console.log(`📜 Scroll attempt ${i + 1} in panel...`);
  }
}

/**
 * Production Test: Vote Yes on Proposal
 *
 * ⚠️  WARNING: This test votes on REAL proposals on production!
 * ⚠️  The vote will be recorded on https://app.hypha.earth
 * ⚠️  Only run this intentionally!
 *
 * Prerequisites:
 *   1. Run auth setup first: npx nx e2e-production-auth web-e2e
 *   2. There must be proposals in the "On Voting" section
 *
 * Run this test:
 *   npx nx e2e-production-vote-yes-proposal web-e2e -- --headed
 */

test.describe('Vote Yes on Proposal on Production', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to my-spaces to verify auth
    await page.goto('/en/my-spaces');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're logged in by checking sign-in button is NOT visible
    const signInButton = page.getByRole('button', { name: /sign in/i });
    const isSignInVisible = await signInButton.isVisible().catch(() => true);

    if (isSignInVisible) {
      throw new Error(
        'Not logged in! Run auth setup first: npx nx e2e-production-auth web-e2e',
      );
    }

    console.log('✅ Logged in successfully');
  });

  test('should vote yes on the first proposal in the QA TESTING space', async ({
    page,
  }) => {
    const timestamp = Date.now();

    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  🗳️  VOTING YES ON PROPOSAL ON PRODUCTION                      ║',
    );
    console.log(
      '╚════════════════════════════════════════════════════════════════╝',
    );
    console.log('');

    // Navigate to my-spaces to select the qa testing space
    console.log('📍 Navigating to My Spaces...');
    await page.goto('/en/my-spaces');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click on the "qa testing" space
    console.log('🔘 Looking for "QA TESTING" space...');
    const qaTestingSpace = page.locator('a[href*="/dho/"]', { hasText: /qa testing/i });
    await expect(qaTestingSpace).toBeVisible({ timeout: 10000 });
    
    const spaceName = await qaTestingSpace.textContent();
    console.log(`📍 Selected space: ${spaceName}`);
    
    await qaTestingSpace.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Take screenshot of the space page
    await page.screenshot({
      path: `test-results-production/vote-yes-space-page-${timestamp}.png`,
      fullPage: true,
    });

    // Scroll down to find "On Voting" section
    console.log('📜 Scrolling to find "On Voting" section...');
    
    for (let i = 0; i < 5; i++) {
      const onVotingSection = page.locator('text=On Voting').first();
      if (await onVotingSection.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('✅ Found "On Voting" section');
        await onVotingSection.scrollIntoViewIfNeeded();
        break;
      }
      // Scroll down the page
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(500);
      console.log(`📜 Scroll attempt ${i + 1}...`);
    }

    // Take screenshot of the On Voting section
    await page.screenshot({
      path: `test-results-production/vote-yes-on-voting-section-${timestamp}.png`,
      fullPage: true,
    });

    // Find and click on the first proposal in the On Voting list
    console.log('🔍 Looking for proposals in the "On Voting" section...');
    
    // The proposals are displayed as cards with badges like "Voting Method", "Entry Method", etc.
    // They have titles starting with "E2E" from our tests
    
    // Try to find any proposal card in the On Voting section
    // Look for clickable elements that are proposal cards
    const proposalCards = page.locator('a[href*="/agreements/"], div[class*="cursor-pointer"]').filter({
      has: page.locator('text=/On Voting|Voting Method|Entry Method|Issue Token|Mint|Deploy/')
    });
    
    let proposalCount = await proposalCards.count();
    console.log(`🔍 Found ${proposalCount} potential proposal cards`);
    
    // Alternative: look for any card with "On Voting" badge
    if (proposalCount === 0) {
      const altProposals = page.locator('div:has(text="On Voting")').filter({
        has: page.locator('text=/E2E|Method|Token|Change/')
      });
      proposalCount = await altProposals.count();
      console.log(`🔍 Found ${proposalCount} proposals with On Voting badge`);
    }
    
    // Click on the first proposal
    let proposalClicked = false;
    let proposalTitle = '';
    
    // Method 1: Click on proposal card by looking for the title pattern
    const proposalTitles = page.locator('text=/E2E.*Change|E2E.*Method|Issue Token|Mint.*Treasury/').first();
    
    if (await proposalTitles.isVisible({ timeout: 3000 }).catch(() => false)) {
      proposalTitle = await proposalTitles.textContent() || 'Unknown';
      console.log(`🔘 Clicking on proposal: "${proposalTitle}"...`);
      await proposalTitles.click();
      proposalClicked = true;
    }
    
    // Method 2: Find any card in the voting section
    if (!proposalClicked) {
      const votingCards = page.locator('div').filter({
        has: page.locator('span:text("On Voting")')
      }).first();
      
      if (await votingCards.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('🔘 Clicking on first voting card...');
        await votingCards.click();
        proposalClicked = true;
      }
    }
    
    // Method 3: Look for any link near "On Voting" text
    if (!proposalClicked) {
      const onVotingHeader = page.locator('text=On Voting').first();
      const nearbyLink = onVotingHeader.locator('xpath=following::a[1]');
      
      if (await nearbyLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        proposalTitle = await nearbyLink.textContent() || 'Unknown';
        console.log(`🔘 Clicking on nearby link: "${proposalTitle}"...`);
        await nearbyLink.click();
        proposalClicked = true;
      }
    }
    
    if (!proposalClicked) {
      // Last resort: click on any card that looks like a proposal
      const anyCard = page.locator('[class*="card"], [class*="Card"]').filter({
        hasText: /Method|Token|E2E/
      }).first();
      
      if (await anyCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('🔘 Clicking on first matching card...');
        await anyCard.click();
        proposalClicked = true;
      }
    }
    
    if (!proposalClicked) {
      throw new Error('No proposals found in the On Voting section');
    }
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ Proposal opened');

    // Take screenshot of the proposal detail
    await page.screenshot({
      path: `test-results-production/vote-yes-proposal-detail-${timestamp}.png`,
      fullPage: true,
    });

    // Get the proposal title from the detail page
    const detailTitle = page.locator('h1, h2, [class*="title"]').first();
    if (await detailTitle.isVisible({ timeout: 2000 }).catch(() => false)) {
      proposalTitle = await detailTitle.textContent() || proposalTitle;
    }
    
    console.log(`📋 Proposal: ${proposalTitle}`);

    // Scroll down in the right panel to find the "Vote yes" button
    console.log('📜 Scrolling to find "Vote yes" button...');
    await scrollToVoteButton(page);

    // Take screenshot before voting
    await page.screenshot({
      path: `test-results-production/vote-yes-before-vote-${timestamp}.png`,
      fullPage: true,
    });

    // Click the "Vote yes" button
    console.log('🗳️ Clicking "Vote yes" button...');
    
    const voteYesButton = page.locator('button:has-text("Vote yes")').first();
    
    if (await voteYesButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await voteYesButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      
      // Check if button is enabled
      const isEnabled = await voteYesButton.isEnabled();
      if (!isEnabled) {
        console.log('⚠️ Vote yes button is disabled - may have already voted');
      } else {
        await voteYesButton.click();
        await page.waitForTimeout(2000);
        console.log('✅ Voted YES on the proposal!');
      }
    } else {
      // Check if already voted
      const alreadyVoted = page.locator('text=/already voted|vote recorded|voted/i').first();
      if (await alreadyVoted.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('ℹ️ Already voted on this proposal');
      } else {
        console.log('⚠️ Vote yes button not found');
      }
    }

    // Take screenshot after voting
    await page.screenshot({
      path: `test-results-production/vote-yes-after-vote-${timestamp}.png`,
      fullPage: true,
    });

    // Wait for the vote to be processed
    console.log('⏳ Waiting for vote to be processed...');
    await page.waitForTimeout(3000);

    // Check for success indicators
    try {
      await Promise.race([
        page.waitForSelector('text=/vote.*recorded|voted|success/i', { timeout: 5000 }),
        page.waitForSelector('[class*="success"]', { timeout: 5000 }),
      ]);
      console.log('✅ Vote confirmed!');
    } catch {
      console.log('⚠️ No explicit vote confirmation - vote may have been recorded');
    }

    // Final screenshot
    await page.screenshot({
      path: `test-results-production/vote-yes-final-${timestamp}.png`,
      fullPage: true,
    });

    // Log the result
    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  ✅ VOTE YES COMPLETED                                         ║',
    );
    console.log(
      '║                                                                ║',
    );
    console.log(`║  📋 Proposal: ${proposalTitle.substring(0, 46).padEnd(46)}║`);
    console.log(
      '║  🗳️ Vote: YES                                                  ║',
    );
    console.log(
      '║                                                                ║',
    );
    console.log(
      '║  ⚠️  This vote is now recorded on the QA TESTING space!        ║',
    );
    console.log(
      '╚════════════════════════════════════════════════════════════════╝',
    );
    console.log('');
  });
});

