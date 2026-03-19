import { test, expect } from '@playwright/test';

/**
 * Production Test: Mint Token to Space Treasury
 *
 * ⚠️  WARNING: This test creates REAL data on production!
 * ⚠️  The mint proposal will appear on https://app.hypha.earth
 * ⚠️  Only run this intentionally!
 *
 * Prerequisites:
 *   1. Run auth setup first: npx nx e2e-production-auth web-e2e
 *   2. Run create-token first: npx nx e2e-production-create-token web-e2e -- --headed
 *   3. Wait about 1 minute for the token to be created
 *
 * Run this test:
 *   npx nx e2e-production-mint-token-treasury web-e2e -- --headed
 */

test.describe('Mint Token to Space Treasury on Production', () => {
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

  test('should mint tokens to space treasury in QA TESTING space', async ({
    page,
  }) => {
    // Increase timeout to 5 minutes (300000ms) since this test includes a 1 minute wait
    test.setTimeout(300000);
    
    // Generate unique proposal title with timestamp
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const proposalTitle = `E2E Mint Treasury ${timestamp}${randomSuffix}`;
    const proposalDescription =
      'This mint proposal was created by automated E2E tests. It can be safely rejected.';
    const mintAmount = '100'; // Amount to mint

    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  🚀 MINTING TOKENS TO SPACE TREASURY ON PRODUCTION             ║',
    );
    console.log(`║  Title: ${proposalTitle.substring(0, 52).padEnd(52)}║`);
    console.log(`║  Amount: ${mintAmount.padEnd(52)}║`);
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

    // ========================================
    // STEP: Vote YES on the Issue Token proposal first
    // ========================================
    console.log('');
    console.log('🗳️ First, we need to vote YES on the Issue Token proposal...');
    console.log('');

    // Scroll down to find "On Voting" section
    console.log('📜 Scrolling to find "On Voting" section...');
    
    // Try to find and scroll to "On Voting" section
    const onVotingSection = page.locator('text=On Voting, h2:has-text("On Voting"), h3:has-text("On Voting")').first();
    
    for (let i = 0; i < 5; i++) {
      if (await onVotingSection.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('✅ Found "On Voting" section');
        break;
      }
      // Scroll down the page
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(500);
      console.log(`📜 Scroll attempt ${i + 1}...`);
    }

    // Take screenshot to see the voting section
    await page.screenshot({
      path: `test-results-production/mint-treasury-voting-section-${timestamp}.png`,
      fullPage: true,
    });

    // Find the "Issue Token" proposal in the On Voting list
    console.log('🔍 Looking for "Issue Token" proposal in voting list...');
    const issueTokenProposal = page.locator('a, div, button').filter({ hasText: /^Issue Token/i }).first();
    
    if (await issueTokenProposal.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('🔘 Clicking on Issue Token proposal...');
      await issueTokenProposal.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      console.log('✅ Issue Token proposal opened');
    } else {
      // Try alternative: look for any link/card that contains "Issue Token"
      const altIssueToken = page.locator('[href*="issue"], [href*="token"]').filter({ hasText: /Issue Token/i }).first();
      if (await altIssueToken.isVisible({ timeout: 3000 }).catch(() => false)) {
        await altIssueToken.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        console.log('✅ Issue Token proposal opened (alt)');
      } else {
        console.log('⚠️ Issue Token proposal not found in voting list - may already be approved');
      }
    }

    // Take screenshot of the proposal page
    await page.screenshot({
      path: `test-results-production/mint-treasury-proposal-page-${timestamp}.png`,
      fullPage: true,
    });

    // Extract the Token Symbol from the proposal to use later when minting
    let tokenSymbolToMint = '';
    console.log('🔍 Looking for Token Symbol in the proposal...');
    
    // First scroll down in the right panel to see the Token Symbol field
    const rightPanelScrollables = page.locator('[data-radix-scroll-area-viewport]');
    const scrollCount = await rightPanelScrollables.count();
    for (let j = 0; j < scrollCount; j++) {
      await rightPanelScrollables.nth(j).evaluate((el) => {
        el.scrollTop += 200;
      }).catch(() => {});
    }
    await page.waitForTimeout(500);
    
    // The Token Symbol is shown in the right panel in a row format
    // Example: "Token Symbol" on the left, "TNVIX" on the right
    // Try to get all text content from the panel and extract the symbol
    
    try {
      // Method 1: Get all page content and use regex to find Token Symbol value
      const pageContent = await page.content();
      // Look for pattern like: Token Symbol followed by uppercase letters
      const symbolRegex = /Token Symbol[^A-Z]*([A-Z]{2,10})/;
      const match = pageContent.match(symbolRegex);
      if (match && match[1]) {
        tokenSymbolToMint = match[1];
        console.log(`✅ Found Token Symbol from page: ${tokenSymbolToMint}`);
      }
    } catch (e) {
      console.log('⚠️ Method 1 failed');
    }
    
    if (!tokenSymbolToMint) {
      // Method 2: Look for the specific row element
      try {
        // Find all text that looks like a token symbol (T + 4 uppercase letters)
        const allText = await page.locator('body').textContent() || '';
        // Look for symbols that start with T and have 4-5 uppercase letters (like TNVIX, TXFBG)
        const symbolMatches = allText.match(/\b(T[A-Z]{3,9})\b/g);
        if (symbolMatches && symbolMatches.length > 0) {
          // Filter out common words and get unique symbols
          const uniqueSymbols = [...new Set(symbolMatches)].filter(s => 
            !['TEST', 'TYPE', 'TOKEN', 'TESTING', 'THIS', 'THAT', 'THEIR', 'THERE', 'TRUE'].includes(s)
          );
          if (uniqueSymbols.length > 0) {
            // The first unique symbol found is likely the token symbol
            tokenSymbolToMint = uniqueSymbols[0];
            console.log(`✅ Extracted Token Symbol: ${tokenSymbolToMint}`);
          }
        }
      } catch (e) {
        console.log('⚠️ Method 2 failed');
      }
    }
    
    if (!tokenSymbolToMint) {
      console.log('⚠️ Could not find Token Symbol - will try to select first available token');
    } else {
      console.log(`📝 Will mint token: ${tokenSymbolToMint}`);
    }

    // Scroll down in the RIGHT SIDE voting panel to find the vote buttons
    console.log('📜 Scrolling in right-side voting panel to find "Vote yes" button...');
    
    // The "Vote yes" button is at the bottom of the right panel
    // Look specifically for "Vote yes" button (exact text from screenshot)
    const voteYesButton = page.locator('button:has-text("Vote yes")').first();
    
    // Scroll within the right side panel to find it
    for (let i = 0; i < 10; i++) {
      if (await voteYesButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('✅ Found "Vote yes" button');
        break;
      }
      
      // Scroll the right side panel - try multiple scroll strategies
      // 1. Try scrolling all scrollable containers
      const scrollableContainers = page.locator('[data-radix-scroll-area-viewport]');
      const count = await scrollableContainers.count();
      for (let j = 0; j < count; j++) {
        await scrollableContainers.nth(j).evaluate((el) => {
          el.scrollTop += 300;
        }).catch(() => {});
      }
      
      // 2. Also try scrolling elements with overflow classes
      await page.evaluate(() => {
        // Find all scrollable elements on the right side
        const scrollables = document.querySelectorAll('[class*="overflow-auto"], [class*="overflow-y-auto"], [class*="scroll"]');
        scrollables.forEach(el => {
          (el as HTMLElement).scrollTop += 300;
        });
      });
      
      await page.waitForTimeout(500);
      console.log(`📜 Scroll attempt ${i + 1} in right panel...`);
    }

    // Take screenshot to see current state
    await page.screenshot({
      path: `test-results-production/mint-treasury-vote-buttons-${timestamp}.png`,
      fullPage: true,
    });

    // Click the "Vote yes" button
    console.log('🗳️ Voting YES on the proposal...');
    
    // Scroll the button into view if needed
    await voteYesButton.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);
    
    if (await voteYesButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await voteYesButton.click();
      await page.waitForTimeout(2000);
      console.log('✅ Voted YES on the proposal!');
      
      // Take screenshot after voting
      await page.screenshot({
        path: `test-results-production/mint-treasury-after-vote-${timestamp}.png`,
        fullPage: true,
      });
      
      // Scroll back up and close the panel before waiting
      console.log('📜 Scrolling back up to close the panel...');
      
      // Scroll up in the right panel
      const scrollableContainersUp = page.locator('[data-radix-scroll-area-viewport]');
      const countUp = await scrollableContainersUp.count();
      for (let j = 0; j < countUp; j++) {
        await scrollableContainersUp.nth(j).evaluate((el) => {
          el.scrollTop = 0; // Scroll to top
        }).catch(() => {});
      }
      await page.waitForTimeout(500);
      
      // Click the Close button
      console.log('❌ Clicking Close button...');
      const closeButton = page.locator('button:has-text("Close"), [aria-label="Close"], button:has(svg[class*="close"]), text=Close').first();
      if (await closeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeButton.click();
        await page.waitForTimeout(1000);
        console.log('✅ Panel closed');
      } else {
        // Try clicking the X button
        const xButton = page.locator('button:has-text("×"), button:has-text("X")').first();
        if (await xButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await xButton.click();
          await page.waitForTimeout(1000);
          console.log('✅ Panel closed (X button)');
        }
      }
      
      // Wait for the vote to be processed and proposal to be approved
      console.log('⏳ Waiting 1 minute for the proposal to be processed...');
      await page.waitForTimeout(60000); // Wait 1 minute
      console.log('✅ Wait completed');
    } else {
      console.log('⚠️ Vote Yes button not found - proposal may already be approved or not ready');
    }

    // Navigate back to the QA Testing space
    console.log('📍 Navigating back to QA Testing space...');
    await page.goto('/en/my-spaces');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Click on the QA testing space again
    const qaTestingSpaceAgain = page.locator('a[href*="/dho/"]', { hasText: /qa testing/i });
    await expect(qaTestingSpaceAgain).toBeVisible({ timeout: 10000 });
    await qaTestingSpaceAgain.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // ========================================
    // Continue with Mint Token to Treasury
    // ========================================
    console.log('');
    console.log('🚀 Now proceeding with Mint Token to Treasury...');
    console.log('');

    // Click on Space Settings
    console.log('⚙️ Opening Space Settings...');
    const settingsButton = page.locator('a[href*="/settings"], button:has-text("Settings"), [aria-label*="settings"], [aria-label*="Settings"]').first();
    
    if (await settingsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsButton.click();
    } else {
      const gearIcon = page.locator('svg[class*="gear"], svg[class*="cog"], [data-testid="settings"]').first();
      if (await gearIcon.isVisible({ timeout: 3000 }).catch(() => false)) {
        await gearIcon.click();
      } else {
        const currentUrl = page.url();
        const settingsUrl = currentUrl.replace('/overview', '/settings').replace(/\/$/, '') + '/settings';
        console.log(`📍 Navigating directly to: ${settingsUrl}`);
        await page.goto(settingsUrl);
      }
    }
    
    await page.waitForTimeout(2000);
    console.log('✅ Space Settings clicked');

    // Wait for the Space Settings panel to appear
    console.log('📋 Waiting for Space Settings panel to open...');
    const settingsHeader = page.locator('text=Space Settings').first();
    await settingsHeader.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ Space Settings panel opened');

    // Take screenshot to see the settings panel
    await page.screenshot({
      path: `test-results-production/mint-treasury-settings-panel-${timestamp}.png`,
      fullPage: true,
    });

    // Scroll down within the settings panel to find "Treasury" section and "Mint Tokens to Space Treasury"
    console.log('📜 Scrolling to find "Treasury" section...');
    
    const scrollableContainers = page.locator('[data-radix-scroll-area-viewport], [class*="overflow-auto"], [class*="overflow-y"], [style*="overflow"]');
    
    // Scroll to find the Treasury section (scroll less aggressively)
    for (let i = 0; i < 5; i++) {
      // Check if Treasury section is visible
      const treasuryVisible = await page.locator('text=Treasury').first().isVisible().catch(() => false);
      if (treasuryVisible) {
        console.log('✅ Found "Treasury" section');
        break;
      }
      
      // Try scrolling each scrollable container (smaller increments)
      const count = await scrollableContainers.count();
      for (let j = 0; j < count; j++) {
        await scrollableContainers.nth(j).evaluate((el) => {
          el.scrollTop += 150; // Smaller scroll increments
        }).catch(() => {});
      }
      
      await page.waitForTimeout(500);
      console.log(`📜 Scroll attempt ${i + 1}...`);
    }

    // Take screenshot after scrolling
    await page.screenshot({
      path: `test-results-production/mint-treasury-after-scroll-${timestamp}.png`,
      fullPage: true,
    });

    // Find and click "Mint Tokens to Space Treasury" - it's the 2nd option under "Treasury" section
    // Look for the exact text from the screenshot
    console.log('🔍 Looking for "Mint Tokens to Space Treasury" (2nd option under Treasury)...');
    
    // Look for the card with "Mint Tokens to Space Treasury" text
    const mintTokenCard = page.locator('text=Mint Tokens to Space Treasury').first();
    
    await expect(mintTokenCard).toBeVisible({ timeout: 10000 });
    console.log('🔘 Clicking "Mint Tokens to Space Treasury" card...');
    await mintTokenCard.click({ force: true });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ Mint Tokens to Space Treasury clicked');

    // Take screenshot of the mint form
    await page.screenshot({
      path: `test-results-production/mint-treasury-form-${timestamp}.png`,
      fullPage: true,
    });

    // Fill out the mint form
    console.log('📝 Filling mint token form...');

    // 1. Fill Proposal Title
    console.log('📝 Entering proposal title...');
    const titleInput = page.getByPlaceholder('Proposal title...');
    await titleInput.waitFor({ state: 'visible', timeout: 10000 });
    await titleInput.fill(proposalTitle);
    console.log(`✅ Title entered: ${proposalTitle}`);

    // 2. Fill Proposal Content/Description
    console.log('📝 Entering proposal description...');
    const descriptionEditor = page.locator('[contenteditable="true"]').first();
    await descriptionEditor.scrollIntoViewIfNeeded();
    await descriptionEditor.click();
    await page.waitForTimeout(300);
    await page.keyboard.type(proposalDescription);
    console.log('✅ Description entered');

    // 3. Scroll down to find the amount and token fields
    console.log('📜 Scrolling to amount and token fields...');
    
    // Look for "Amount" or "Token" label to scroll to
    const amountLabel = page.locator('text=Amount, label:has-text("Amount")').first();
    if (await amountLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await amountLabel.scrollIntoViewIfNeeded();
    }
    await page.waitForTimeout(500);

    // 4. Fill in the amount
    console.log('💰 Entering mint amount...');
    const amountInput = page.locator('input[placeholder="Amount"], input[type="number"]').first();
    await amountInput.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    if (await amountInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await amountInput.click();
      await page.waitForTimeout(300);
      await amountInput.fill(mintAmount);
      console.log(`✅ Amount entered: ${mintAmount}`);
    } else {
      console.log('⚠️ Amount input not found - trying alternative selectors');
      // Try alternative selectors
      const altAmountInput = page.getByPlaceholder('Amount').first();
      if (await altAmountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await altAmountInput.fill(mintAmount);
        console.log(`✅ Amount entered (alt): ${mintAmount}`);
      }
    }

    // 5. Select the token - click "Select a token" dropdown and pick the first one
    console.log('🪙 Selecting token...');
    
    // Find the "Select a token" dropdown button (exact text from screenshot)
    const tokenDropdown = page.locator('button:has-text("Select a token"), div:has-text("Select a token"):not(:has(*:has-text("Select a token")))').first();
    await tokenDropdown.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    // Take screenshot before clicking dropdown
    await page.screenshot({
      path: `test-results-production/mint-treasury-before-token-select-${timestamp}.png`,
      fullPage: true,
    });
    
    if (await tokenDropdown.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('🔘 Clicking "Select a token" dropdown...');
      await tokenDropdown.click();
      await page.waitForTimeout(1000);
      
      // Take screenshot of dropdown open
      await page.screenshot({
        path: `test-results-production/mint-treasury-token-dropdown-open-${timestamp}.png`,
        fullPage: true,
      });
      
      // Look for token options in the dropdown popover
      // First priority: use the token symbol we remembered from the Issue Token proposal
      
      let tokenSelected = false;
      
      // If we have a remembered token symbol, try to select it first
      if (tokenSymbolToMint) {
        console.log(`🔍 Looking for remembered token: ${tokenSymbolToMint}...`);
        
        // First, scroll within the dropdown menu to find the token
        // The dropdown is a small popover that appears over "Select a token"
        console.log('📜 Scrolling within the dropdown menu to find the token...');
        
        const dropdownScrollable = page.locator('[data-radix-popper-content-wrapper] [data-radix-scroll-area-viewport], [role="listbox"], [class*="popover"] [class*="scroll"], [class*="dropdown"] [class*="overflow"]');
        
        // Try scrolling within the dropdown to find the token
        for (let scrollAttempt = 0; scrollAttempt < 5; scrollAttempt++) {
          // Check if the token is visible
          const tokenInDropdown = page.locator(`text="${tokenSymbolToMint}"`).first();
          if (await tokenInDropdown.isVisible({ timeout: 500 }).catch(() => false)) {
            console.log(`✅ Found token ${tokenSymbolToMint} in dropdown`);
            await tokenInDropdown.click({ force: true });
            await page.waitForTimeout(500);
            console.log(`✅ Token selected: ${tokenSymbolToMint} (from Issue Token proposal)`);
            tokenSelected = true;
            break;
          }
          
          // Scroll within the dropdown popover
          const dropdownCount = await dropdownScrollable.count();
          if (dropdownCount > 0) {
            for (let d = 0; d < dropdownCount; d++) {
              await dropdownScrollable.nth(d).evaluate((el) => {
                el.scrollTop += 100;
              }).catch(() => {});
            }
          }
          
          // Also try scrolling any visible scrollable element in the popover
          await page.evaluate(() => {
            const popovers = document.querySelectorAll('[data-radix-popper-content-wrapper] *, [class*="popover"] *, [class*="dropdown"] *');
            popovers.forEach(el => {
              if ((el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight) {
                (el as HTMLElement).scrollTop += 100;
              }
            });
          });
          
          await page.waitForTimeout(300);
          console.log(`📜 Dropdown scroll attempt ${scrollAttempt + 1}...`);
        }
        
        // If still not selected, try other selectors
        if (!tokenSelected) {
          const tokenSelectors = [
            page.locator(`div:has-text("${tokenSymbolToMint}"):has-text("by QA")`).first(),
            page.locator(`span:text-is("${tokenSymbolToMint}"), div:text-is("${tokenSymbolToMint}")`).first(),
          ];
          
          for (const selector of tokenSelectors) {
            if (await selector.isVisible({ timeout: 1000 }).catch(() => false)) {
              console.log(`🔘 Clicking remembered token: ${tokenSymbolToMint}...`);
              await selector.click({ force: true });
              await page.waitForTimeout(500);
              console.log(`✅ Token selected: ${tokenSymbolToMint}`);
              tokenSelected = true;
              break;
            }
          }
        }
      }
      
      // Fallback: try other known token names
      if (!tokenSelected) {
        const tokenNames = ['QATEST', 'TXFBG', 'TXCSE', 'THPWQ', 'VOICEQATES'];
        
        for (const tokenName of tokenNames) {
          console.log(`🔍 Looking for token: ${tokenName}...`);
          const tokenOption = page.locator(`div:has-text("${tokenName}"):has-text("by QA")`).first();
          
          if (await tokenOption.isVisible({ timeout: 1000 }).catch(() => false)) {
            console.log(`🔘 Clicking token: ${tokenName}...`);
            await tokenOption.click({ force: true });
            await page.waitForTimeout(500);
            console.log(`✅ Token selected: ${tokenName}`);
            tokenSelected = true;
            break;
          }
        }
      }
      
      if (!tokenSelected) {
        // Try alternative: look for any element with "Utility" or "Credits" badge
        console.log('🔍 Trying to click token by badge type...');
        const tokenWithBadge = page.locator('div:has-text("Utility"):has-text("by QA"), div:has-text("Credits"):has-text("by QA")').first();
        if (await tokenWithBadge.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tokenWithBadge.click({ force: true });
          await page.waitForTimeout(500);
          console.log('✅ Token selected by badge');
          tokenSelected = true;
        }
      }
      
      if (!tokenSelected) {
        // Last resort: look for clickable items in the dropdown popover
        console.log('🔍 Trying popover content...');
        const popoverContent = page.locator('[data-radix-popper-content-wrapper] div[class*="cursor"], [role="listbox"] div');
        const count = await popoverContent.count();
        console.log(`Found ${count} items in popover`);
        if (count > 0) {
          await popoverContent.first().click({ force: true });
          console.log('✅ Token selected from popover');
        } else {
          console.log('⚠️ Could not find any token to select');
        }
      }
    } else {
      console.log('⚠️ Token dropdown not found');
    }

    // Wait for form validation
    await page.waitForTimeout(1000);

    // Take screenshot before submitting
    await page.screenshot({
      path: `test-results-production/mint-treasury-form-filled-${timestamp}.png`,
      fullPage: true,
    });

    // Find and click the Publish/Submit button
    console.log('🔍 Looking for Publish button...');
    const submitButton = page.locator('button:has-text("Publish"), button:has-text("Submit"), button:has-text("Create"), button[type="submit"]').last();
    
    await submitButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();

    console.log('📝 Form filled, clicking Publish...');
    await submitButton.click();
    
    console.log('✅ Publish button clicked!');

    // Wait for submission to complete
    console.log(
      '⏳ Waiting for mint proposal creation (this may take up to 2 minutes)...',
    );

    // Wait for loading bar/spinner to appear and then disappear
    const loadingSelectors = [
      '.animate-spin',
      '[class*="progress"]',
      '[class*="loading"]',
      '[role="progressbar"]',
      'text=/creating/i',
      'text=/publishing/i',
      'text=/minting/i',
    ];

    // Wait a bit for loading to start
    await page.waitForTimeout(2000);

    // Check if any loading indicator is visible and wait for it to disappear
    for (const selector of loadingSelectors) {
      const loadingElement = page.locator(selector).first();
      if (await loadingElement.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`🔄 Loading detected (${selector}), waiting for completion...`);
        await loadingElement.waitFor({ state: 'hidden', timeout: 120000 }).catch(() => {
          console.log('⚠️ Loading indicator still visible after timeout');
        });
        console.log('✅ Loading completed');
        break;
      }
    }

    // Additional wait
    await page.waitForTimeout(3000);

    // Take screenshot after loading
    await page.screenshot({
      path: `test-results-production/mint-treasury-after-loading-${timestamp}.png`,
      fullPage: true,
    });

    // Wait for navigation away from create page or success indicator
    try {
      await Promise.race([
        page.waitForURL((url) => !url.pathname.includes('/create'), { timeout: 60000 }),
        page.waitForSelector('text=/success/i', { timeout: 60000 }),
        page.waitForSelector('text=/created/i', { timeout: 60000 }),
      ]);
      console.log('✅ Mint proposal creation appears to have succeeded!');
    } catch {
      await page.screenshot({
        path: `test-results-production/mint-treasury-error-${timestamp}.png`,
        fullPage: true,
      });

      const currentUrl = page.url();
      if (currentUrl.includes('/create')) {
        const errorMessages = await page
          .locator('[data-slot="form-message"], [role="alert"], text=/error/i')
          .allTextContents();
        const realErrors = errorMessages.filter(
          (msg) => msg.trim() && msg.trim() !== '*' && msg.trim().length > 2,
        );

        if (realErrors.length > 0) {
          throw new Error(
            `Mint proposal creation failed with error: ${realErrors.join(', ')}`,
          );
        }
        throw new Error(
          'Mint proposal creation did not complete - still on create page',
        );
      }
    }

    // Get the final URL
    const finalUrl = page.url();
    console.log(`📍 Final URL: ${finalUrl}`);

    // Take a success screenshot
    await page.screenshot({
      path: `test-results-production/mint-treasury-success-${timestamp}.png`,
      fullPage: true,
    });

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're not on an error page
    const notFoundIndicator = page.locator('text=/not found|404|page.*error/i');
    if (await notFoundIndicator.isVisible().catch(() => false)) {
      throw new Error('Mint proposal page shows error or not found');
    }

    // Log the result
    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  ✅ MINT TOKEN TO TREASURY PROPOSAL CREATED SUCCESSFULLY       ║',
    );
    console.log(
      '║                                                                ║',
    );
    console.log(`║  URL: ${finalUrl.substring(0, 54).padEnd(54)}║`);
    console.log(
      '║                                                                ║',
    );
    console.log(
      '║  ⚠️  Remember to reject this test proposal!                    ║',
    );
    console.log(
      '╚════════════════════════════════════════════════════════════════╝',
    );
    console.log('');

    // Final assertion
    expect(finalUrl).not.toContain('/create');
  });
});

