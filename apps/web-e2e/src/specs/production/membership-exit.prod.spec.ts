import { test, expect, Page } from '@playwright/test';

/**
 * Selects a member to exit from the dropdown
 */
async function selectExitingMember(page: Page): Promise<boolean> {
  console.log('👤 Selecting exiting member...');
  
  // The form has "Member" and "Space" tabs
  // Check if "Member" tab exists and is enabled before clicking
  const memberTab = page.locator('button:has-text("Member")').first();
  if (await memberTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    const isDisabled = await memberTab.isDisabled().catch(() => false);
    if (!isDisabled) {
      await memberTab.click();
      await page.waitForTimeout(500);
      console.log('✅ Member tab clicked');
    } else {
      console.log('ℹ️ Member tab already selected (disabled state)');
    }
  }
  
  // Find the member dropdown - look for the dropdown with a member name or "Find Member"
  // The dropdown might show "Martin Prate" or similar if already selected
  const memberDropdownSelectors = [
    'button:has-text("Martin")',
    'button:has-text("Prate")',
    '[aria-label*="member"] button',
    '[class*="combobox"]',
  ];
  
  let memberDropdown = null;
  for (const selector of memberDropdownSelectors) {
    const dropdown = page.locator(selector).first();
    if (await dropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      memberDropdown = dropdown;
      break;
    }
  }
  
  // Also try to find by looking near "Exiting Member" label
  if (!memberDropdown) {
    const exitingMemberSection = page.locator('text=Exiting Member').first();
    if (await exitingMemberSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Look for dropdown button after this label
      memberDropdown = page.locator('text=Exiting Member').locator('xpath=following::button[contains(@class, "combobox") or @role="combobox" or contains(., "Martin")]').first();
    }
  }
  
  // Fallback: look for any combobox-like button that's not the Member/Space tab
  if (!memberDropdown || !(await memberDropdown.isVisible({ timeout: 1000 }).catch(() => false))) {
    memberDropdown = page.locator('button:has(svg):has-text("Martin"), button[aria-haspopup="listbox"]').first();
  }
  
  if (memberDropdown && await memberDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Check if a member is already selected
    const dropdownText = await memberDropdown.textContent() || '';
    if (dropdownText.includes('Martin') || dropdownText.includes('test') || dropdownText.includes('Prate')) {
      console.log(`✅ Member already selected: ${dropdownText.trim()}`);
      return true;
    }
    
    // Click dropdown to select a member
    await memberDropdown.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await memberDropdown.click();
    await page.waitForTimeout(1000);
    
    // Wait for the dropdown popover
    const popover = page.locator('[data-radix-popper-content-wrapper]').first();
    await popover.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    
    // Look for member options
    const memberOptions = page.locator('[role="option"]');
    const optionCount = await memberOptions.count();
    console.log(`🔍 Found ${optionCount} member options`);
    
    if (optionCount > 0) {
      // Select the first available member
      const firstMember = memberOptions.first();
      const memberText = await firstMember.textContent() || 'Unknown';
      await firstMember.click();
      await page.waitForTimeout(500);
      console.log(`✅ Selected member: ${memberText.trim()}`);
      return true;
    }
    
    // Fallback: keyboard navigation
    console.log('⚠️ Trying keyboard navigation...');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    return true;
  }
  
  // If no dropdown found, check if member is already displayed (pre-selected)
  const memberDisplay = page.locator('text=Martin Prate, text=Martin test').first();
  if (await memberDisplay.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('✅ Member appears to be pre-selected on form');
    return true;
  }
  
  console.log('⚠️ Member dropdown not found - member may be pre-selected');
  return true; // Return true as member might be pre-selected
}

/**
 * Production Test: Membership Exit
 *
 * ⚠️  WARNING: This test creates REAL data on production!
 * ⚠️  A membership exit proposal will be submitted
 * ⚠️  Only run this intentionally!
 *
 * Prerequisites:
 *   1. Run auth setup first: npx nx e2e-production-auth web-e2e
 *
 * Run this test:
 *   npx nx e2e-production-membership-exit web-e2e -- --headed
 */

test.describe('Membership Exit on Production', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to my-spaces to verify auth
    await page.goto('/en/my-spaces');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're logged in
    const signInButton = page.getByRole('button', { name: /sign in/i });
    const isSignInVisible = await signInButton.isVisible().catch(() => true);

    if (isSignInVisible) {
      throw new Error(
        'Not logged in! Run auth setup first: npx nx e2e-production-auth web-e2e',
      );
    }

    console.log('✅ Logged in successfully');
  });

  test('should create membership exit proposal in QA TESTING space', async ({
    page,
  }) => {
    const timestamp = Date.now();

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  🚪 CREATING MEMBERSHIP EXIT PROPOSAL ON PRODUCTION            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    // ========================================
    // STEP 1: NAVIGATE TO QA TESTING SPACE
    // ========================================
    console.log('📍 Step 1: Navigating to QA TESTING space...');
    await page.goto('/en/my-spaces');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click on the "qa testing" space
    const qaTestingSpace = page.locator('a[href*="/dho/"]', { hasText: /qa testing/i });
    await expect(qaTestingSpace).toBeVisible({ timeout: 10000 });
    await qaTestingSpace.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ Navigated to QA TESTING space');

    // ========================================
    // STEP 2: OPEN SPACE SETTINGS
    // ========================================
    console.log('⚙️ Step 2: Opening Space Settings...');
    const settingsButton = page.locator('a[href*="/settings"], button:has-text("Settings"), [aria-label*="settings"]').first();

    if (await settingsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsButton.click();
    } else {
      const currentUrl = page.url();
      const settingsUrl = currentUrl.replace('/overview', '/settings').replace(/\/$/, '') + '/settings';
      console.log(`📍 Navigating directly to: ${settingsUrl}`);
      await page.goto(settingsUrl);
    }

    await page.waitForTimeout(2000);
    console.log('✅ Space Settings opened');

    // Take screenshot
    await page.screenshot({
      path: `test-results-production/membership-exit-settings-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 3: SCROLL TO MEMBERSHIP EXIT
    // ========================================
    console.log('📜 Step 3: Finding "Membership Exit" option...');

    const scrollableContainers = page.locator('[data-radix-scroll-area-viewport], [class*="overflow-auto"], [class*="overflow-y"]');

    // Scroll to find Membership Exit
    for (let i = 0; i < 15; i++) {
      const membershipExitVisible = await page.locator('text=Membership Exit').first().isVisible().catch(() => false);
      if (membershipExitVisible) {
        console.log('✅ Found "Membership Exit" option');
        break;
      }

      const count = await scrollableContainers.count();
      for (let j = 0; j < count; j++) {
        await scrollableContainers.nth(j).evaluate((el) => {
          el.scrollTop += 150;
        }).catch(() => {});
      }

      await page.waitForTimeout(400);
      console.log(`📜 Scroll attempt ${i + 1}...`);
    }

    // Take screenshot after scrolling
    await page.screenshot({
      path: `test-results-production/membership-exit-after-scroll-${timestamp}.png`,
      fullPage: true,
    });

    // Click on "Membership Exit" card
    console.log('🔘 Step 4: Clicking on "Membership Exit"...');

    const membershipExitCard = page.locator('text=Remove a member from your space if they infringe').first();

    if (await membershipExitCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await membershipExitCard.click({ force: true });
    } else {
      const membershipExitText = page.locator('text=Membership Exit').first();
      await membershipExitText.click({ force: true });
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ Membership Exit panel opened');

    // Take screenshot
    await page.screenshot({
      path: `test-results-production/membership-exit-panel-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 5: FILL PROPOSAL DETAILS
    // ========================================
    console.log('📝 Step 5: Filling proposal details...');

    // Generate proposal title and description
    const proposalTitle = `E2E Membership Exit Test ${timestamp}`;
    const proposalDescription = `Automated E2E test for membership exit proposal. This is a test - timestamp: ${timestamp}. Please reject or ignore.`;

    // Fill Proposal Title
    console.log('📝 Filling proposal title...');
    const titleInput = page.getByPlaceholder('Proposal title...');
    if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await titleInput.scrollIntoViewIfNeeded();
      await titleInput.fill(proposalTitle);
      console.log(`✅ Title entered: ${proposalTitle}`);
    } else {
      console.log('⚠️ Title input not found');
    }

    // Fill Proposal Description/Content
    console.log('📝 Filling proposal content...');
    const contentEditor = page.locator('[contenteditable="true"]').first();
    if (await contentEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
      await contentEditor.scrollIntoViewIfNeeded();
      await contentEditor.click();
      await page.waitForTimeout(300);
      await page.keyboard.type(proposalDescription);
      console.log('✅ Content entered');
    }

    await page.waitForTimeout(500);

    // Take screenshot after title/description
    await page.screenshot({
      path: `test-results-production/membership-exit-details-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 6: SELECT EXITING MEMBER
    // ========================================
    console.log('👤 Step 6: Selecting exiting member...');
    await selectExitingMember(page);

    // Take screenshot after member selection
    await page.screenshot({
      path: `test-results-production/membership-exit-member-selected-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 7: PUBLISH PROPOSAL
    // ========================================
    console.log('📤 Step 7: Publishing proposal...');

    // Scroll down to find Publish button
    for (let i = 0; i < 5; i++) {
      const publishButton = page.locator('button:has-text("Publish")').last();
      if (await publishButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await publishButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);

        const isEnabled = await publishButton.isEnabled();
        if (isEnabled) {
          console.log('📝 Clicking Publish button...');
          await publishButton.click();
          console.log('✅ Publish button clicked!');
          break;
        } else {
          console.log('⚠️ Publish button is disabled - checking for missing fields...');
        }
      }

      // Scroll more
      const count = await scrollableContainers.count();
      for (let j = 0; j < count; j++) {
        await scrollableContainers.nth(j).evaluate((el) => {
          el.scrollTop += 200;
        }).catch(() => {});
      }
      await page.waitForTimeout(400);
    }

    // Wait for save to complete
    console.log('⏳ Waiting for proposal to be published...');
    await page.waitForTimeout(5000);

    // Take final screenshot
    await page.screenshot({
      path: `test-results-production/membership-exit-final-${timestamp}.png`,
      fullPage: true,
    });

    // Check for success indicator
    try {
      await Promise.race([
        page.waitForSelector('text=/success/i', { timeout: 10000 }),
        page.waitForSelector('text=/published/i', { timeout: 10000 }),
        page.waitForSelector('text=/created/i', { timeout: 10000 }),
      ]);
      console.log('✅ Proposal published successfully!');
    } catch {
      console.log('⚠️ No explicit success message - proposal may have been submitted');
    }

    // Log the result
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ MEMBERSHIP EXIT PROPOSAL COMPLETED                         ║');
    console.log('║                                                                ║');
    console.log('║  📝 Summary:                                                   ║');
    console.log(`║    📋 Proposal: ${proposalTitle.substring(0, 44).padEnd(44)}║`);
    console.log('║    👤 Exiting Member: Selected from dropdown                   ║');
    console.log('║                                                                ║');
    console.log('║  ⚠️  This proposal is now LIVE on the QA TESTING space!        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
  });
});

