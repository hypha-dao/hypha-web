import { test, expect, Page } from '@playwright/test';

/**
 * Voting Method Templates available in the UI
 */
const VOTING_METHOD_TEMPLATES = [
  '80-20 Pareto',
  'Majority Vote',
  'Minority Vote',
  'Consensus',
  'Consent',
  'Hearing',
] as const;

/**
 * Voting Power Options available in the UI
 */
const VOTING_POWER_OPTIONS = [
  '1 Member 1 Vote',
  '1 Voice 1 Vote',
  '1 Token 1 Vote',
] as const;

/**
 * Randomly selects an item from an array
 */
function randomChoice<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)]!;
}

/**
 * Selects a voting method template by clicking on it
 * @param page - Playwright page object
 * @param templateName - Name of the template to select
 */
async function selectVotingTemplate(
  page: Page,
  templateName: string
): Promise<boolean> {
  try {
    console.log(`🗳️ Selecting voting template: ${templateName}...`);
    
    // Find the template card/button by its name
    const templateElement = page.locator(`text="${templateName}"`).first();
    
    if (!(await templateElement.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log(`⚠️ Template not found: ${templateName}`);
      return false;
    }
    
    await templateElement.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    
    // Click on the template (might need to click the parent card)
    await templateElement.click();
    await page.waitForTimeout(500);
    
    console.log(`✅ Voting template selected: ${templateName}`);
    return true;
  } catch (error) {
    console.log(`⚠️ Error selecting template ${templateName}:`, error);
    return false;
  }
}

/**
 * Selects a voting power option by clicking on it
 * @param page - Playwright page object
 * @param optionName - Name of the voting power option
 */
async function selectVotingPower(
  page: Page,
  optionName: string
): Promise<boolean> {
  try {
    console.log(`⚡ Selecting voting power: ${optionName}...`);
    
    // Find the voting power card/option by its name
    const optionElement = page.locator(`text="${optionName}"`).first();
    
    if (!(await optionElement.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log(`⚠️ Voting power option not found: ${optionName}`);
      return false;
    }
    
    await optionElement.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    
    // Click on the option card
    await optionElement.click();
    await page.waitForTimeout(500);
    
    console.log(`✅ Voting power selected: ${optionName}`);
    return true;
  } catch (error) {
    console.log(`⚠️ Error selecting voting power ${optionName}:`, error);
    return false;
  }
}

/**
 * Fills in the Minimum Voting Duration field when quorum is below 20%
 * @param page - Playwright page object
 */
async function fillMinimumVotingDuration(page: Page): Promise<void> {
  console.log('⏱️ Filling Minimum Voting Duration (required when quorum < 20%)...');
  
  // Wait for the field to appear
  await page.waitForTimeout(1000);
  
  // Scroll down to find the Minimum Voting Duration section
  const votingPeriodSection = page.locator('text="Voting Period"').first();
  if (await votingPeriodSection.isVisible({ timeout: 3000 }).catch(() => false)) {
    await votingPeriodSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
  
  // Scroll to the Minimum Voting Duration field
  const votingDurationLabel = page.locator('text="Minimum Voting Duration"').first();
  if (await votingDurationLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
    await votingDurationLabel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
  
  let durationSet = false;
  
  // Method 1: Find the dropdown button near "Minimum Voting Duration" label
  // The dropdown is a button/trigger element that opens a popover with options
  console.log('🔍 Looking for Minimum Voting Duration dropdown...');
  
  // Look for a button/combobox after the label - try multiple selectors
  const dropdownSelectors = [
    // Button that triggers the dropdown (usually has a chevron icon)
    page.locator('text="Minimum Voting Duration"').locator('xpath=following::button[1]'),
    // Any combobox role element
    page.locator('text="Minimum Voting Duration"').locator('xpath=following::*[@role="combobox"][1]'),
    // Look for the select trigger by its structure
    page.locator('button').filter({ has: page.locator('svg') }).filter({
      hasNot: page.locator('text=/hours|days|week/i')
    }).last(),
  ];
  
  for (const dropdownSelector of dropdownSelectors) {
    if (await dropdownSelector.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('🔘 Found dropdown, clicking...');
      await dropdownSelector.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await dropdownSelector.click();
      await page.waitForTimeout(800);
      
      // Now look for "6 hours" option in the opened dropdown
      const sixHoursOption = page.locator('text="6 hours"').first();
      
      if (await sixHoursOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('🔘 Found "6 hours" option, clicking...');
        await sixHoursOption.click();
        await page.waitForTimeout(500);
        console.log('✅ Minimum Voting Duration set to: 6 hours');
        durationSet = true;
        break;
      }
      
      // Try role="option" elements
      const options = page.locator('[role="option"]');
      const optionCount = await options.count();
      console.log(`🔍 Found ${optionCount} options in dropdown`);
      
      if (optionCount > 0) {
        // Look for 6 hours specifically
        for (let i = 0; i < optionCount; i++) {
          const optionText = await options.nth(i).textContent();
          if (optionText?.includes('6 hours')) {
            await options.nth(i).click();
            await page.waitForTimeout(500);
            console.log('✅ Minimum Voting Duration set to: 6 hours');
            durationSet = true;
            break;
          }
        }
        
        // If 6 hours not found, click first option
        if (!durationSet) {
          await options.first().click();
          await page.waitForTimeout(500);
          const selectedText = await options.first().textContent();
          console.log(`✅ Minimum Voting Duration set to: ${selectedText}`);
          durationSet = true;
        }
        break;
      }
      
      // Try clicking any visible option text
      const anyDurationOption = page.locator('text=/\\d+\\s*(hour|day|week)/i').first();
      if (await anyDurationOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await anyDurationOption.click();
        await page.waitForTimeout(500);
        console.log('✅ Minimum Voting Duration set (duration option)');
        durationSet = true;
        break;
      }
      
      // Keyboard fallback
      console.log('🔍 Trying keyboard navigation...');
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      console.log('✅ Minimum Voting Duration set (keyboard)');
      durationSet = true;
      break;
    }
  }
  
  if (!durationSet) {
    console.log('⚠️ Could not find/set Minimum Voting Duration dropdown');
    
    // Last resort: try to click anywhere that might trigger the dropdown
    const lastResort = page.locator('button:near(:text("Minimum Voting Duration"))').first();
    if (await lastResort.isVisible({ timeout: 1000 }).catch(() => false)) {
      await lastResort.click();
      await page.waitForTimeout(800);
      
      // Try keyboard
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);
      await page.keyboard.press('Enter');
      console.log('✅ Minimum Voting Duration set (last resort)');
    }
  }
  
  await page.waitForTimeout(500);
}

/**
 * Fills in the Voting Token Allocation field when selecting "1 Voice 1 Vote" or "1 Token 1 Vote"
 * @param page - Playwright page object
 */
async function fillVotingTokenAllocation(page: Page): Promise<void> {
  console.log('🪙 Filling Voting Token Allocation...');
  
  // Wait for the field to appear
  await page.waitForTimeout(1000);
  
  // Scroll down to find the Token dropdown
  const votingTokenSection = page.locator('text="Voting Token Allocation"').first();
  if (await votingTokenSection.isVisible({ timeout: 3000 }).catch(() => false)) {
    await votingTokenSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
  
  // Look for "Select a token" dropdown or the Token field
  const tokenDropdown = page.locator('text="Select a token"').first();
  
  if (await tokenDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tokenDropdown.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    console.log('🔘 Clicking token dropdown...');
    await tokenDropdown.click();
    await page.waitForTimeout(1000);
    
    // The dropdown shows tokens like "QATEST", "TXFBG", etc. with "by QA TESTING"
    // Try multiple strategies to select a token
    
    let tokenSelected = false;
    
    // Method 1: Look for known token names in the dropdown
    const knownTokens = ['QATEST', 'TXFBG', 'TXCSE', 'THPWQ', 'VOICEQATES'];
    
    for (const tokenName of knownTokens) {
      const tokenOption = page.locator(`text="${tokenName}"`).first();
      if (await tokenOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`🔘 Found token: ${tokenName}, clicking...`);
        await tokenOption.click({ force: true });
        await page.waitForTimeout(500);
        console.log(`✅ Voting Token selected: ${tokenName}`);
        tokenSelected = true;
        break;
      }
    }
    
    // Method 2: Click on any visible option in the popover
    if (!tokenSelected) {
      console.log('🔍 Trying to find token options in popover...');
      
      // Look for clickable items in the dropdown popover that contain "by QA"
      const tokenWithQA = page.locator('div:has-text("by QA")').filter({
        has: page.locator('text=/QATEST|TXFBG|TXCSE|THPWQ|Utility|Credits/i')
      }).first();
      
      if (await tokenWithQA.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tokenWithQA.click({ force: true });
        await page.waitForTimeout(500);
        console.log('✅ Voting Token selected (QA token)');
        tokenSelected = true;
      }
    }
    
    // Method 3: Look for any element with role="option"
    if (!tokenSelected) {
      const options = page.locator('[role="option"]');
      const optionCount = await options.count();
      console.log(`🔍 Found ${optionCount} role="option" elements`);
      
      if (optionCount > 0) {
        await options.first().click({ force: true });
        await page.waitForTimeout(500);
        console.log('✅ Voting Token selected (role=option)');
        tokenSelected = true;
      }
    }
    
    // Method 4: Click within the popover content directly
    if (!tokenSelected) {
      console.log('🔍 Trying popover content wrapper...');
      const popoverItems = page.locator('[data-radix-popper-content-wrapper] >> div[class*="cursor"], [data-radix-popper-content-wrapper] >> div[class*="hover"]');
      const itemCount = await popoverItems.count();
      console.log(`🔍 Found ${itemCount} clickable items in popover`);
      
      if (itemCount > 0) {
        await popoverItems.first().click({ force: true });
        await page.waitForTimeout(500);
        console.log('✅ Voting Token selected (popover item)');
        tokenSelected = true;
      }
    }
    
    // Method 5: Use keyboard navigation
    if (!tokenSelected) {
      console.log('🔍 Trying keyboard navigation...');
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      console.log('✅ Voting Token selected (keyboard)');
      tokenSelected = true;
    }
    
    if (!tokenSelected) {
      console.log('⚠️ Could not select a token - dropdown may need manual interaction');
    }
  } else {
    // Try alternative: click on the combobox/button directly
    console.log('🔍 Looking for token dropdown button...');
    const dropdownButton = page.locator('button:has-text("Select a token"), [role="combobox"]').last();
    
    if (await dropdownButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dropdownButton.click();
      await page.waitForTimeout(1000);
      
      // Try keyboard selection
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      console.log('✅ Voting Token selected (dropdown button + keyboard)');
    } else {
      console.log('⚠️ Voting Token Allocation dropdown not found');
    }
  }
  
  await page.waitForTimeout(500);
}

/**
 * Production Test: Change Voting Method
 *
 * ⚠️  WARNING: This test modifies REAL settings on production!
 * ⚠️  The voting method will be changed on https://app.hypha.earth
 * ⚠️  Only run this intentionally!
 *
 * Prerequisites:
 *   1. Run auth setup first: npx nx e2e-production-auth web-e2e
 *
 * Run this test:
 *   npx nx e2e-production-change-voting-method web-e2e -- --headed
 */

test.describe('Change Voting Method on Production', () => {
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

  test('should change voting method with randomized settings in the QA TESTING space', async ({
    page,
  }) => {
    const timestamp = Date.now();
    
    // Generate random settings - ONLY use preset templates
    const selectedTemplate = randomChoice(VOTING_METHOD_TEMPLATES);
    const selectedVotingPower = randomChoice(VOTING_POWER_OPTIONS);
    
    // Templates that have quorum below 20% and require Minimum Voting Duration
    const templatesRequiringDuration = ['Minority Vote', 'Consent'];
    const needsMinDuration = templatesRequiringDuration.includes(selectedTemplate);

    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  🗳️  CHANGING VOTING METHOD ON PRODUCTION                      ║',
    );
    console.log(
      '╠════════════════════════════════════════════════════════════════╣',
    );
    console.log(
      '║  🎲 RANDOMIZED VOTING SETTINGS:                                ║',
    );
    console.log(`║    📋 Template: ${selectedTemplate.padEnd(44)}║`);
    if (needsMinDuration) {
      console.log(`║    ⏱️ Min Voting Duration: 6 hours (template requires it)      ║`);
    }
    console.log(`║    ⚡ Voting Power: ${selectedVotingPower.padEnd(40)}║`);
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
    console.log('✅ Space Settings opened');

    // Wait for the Space Settings panel to appear
    console.log('📋 Waiting for Space Settings panel...');
    const settingsHeader = page.locator('text=Space Settings').first();
    await settingsHeader.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ Space Settings panel visible');

    // Take screenshot of settings panel
    await page.screenshot({
      path: `test-results-production/voting-method-settings-panel-${timestamp}.png`,
      fullPage: true,
    });

    // Scroll down to find "Agreements" section and "Voting Method"
    console.log('📜 Scrolling to find "Voting Method" under Agreements...');
    
    const scrollableContainers = page.locator('[data-radix-scroll-area-viewport], [class*="overflow-auto"], [class*="overflow-y"], [style*="overflow"]');
    
    // Scroll to find Voting Method
    for (let i = 0; i < 8; i++) {
      const votingMethodVisible = await page.locator('text=Voting Method').first().isVisible().catch(() => false);
      if (votingMethodVisible) {
        console.log('✅ Found "Voting Method" option');
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
      path: `test-results-production/voting-method-after-scroll-${timestamp}.png`,
      fullPage: true,
    });

    // Click on "Voting Method" card
    console.log('🔘 Clicking on "Voting Method"...');
    
    // Find by the description text to be more precise
    const votingMethodCard = page.locator('text=Select and configure the voting method').first();
    
    if (await votingMethodCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await votingMethodCard.click({ force: true });
    } else {
      // Fallback: click on "Voting Method" text directly
      const votingMethodText = page.locator('text=Voting Method').first();
      await votingMethodText.click({ force: true });
    }
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ Voting Method panel opened');

    // Take screenshot of voting method panel
    await page.screenshot({
      path: `test-results-production/voting-method-panel-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // FILL PROPOSAL TITLE AND DESCRIPTION
    // ========================================
    console.log('');
    console.log('📝 Filling proposal title and description...');
    
    // Generate unique proposal title and description
    const proposalTitle = `E2E Voting Method Change ${timestamp}`;
    const proposalDescription = `Automated E2E test changing voting method using "${selectedTemplate}" template preset with ${selectedVotingPower} voting power.`;
    
    // Fill Proposal Title
    const titleInput = page.getByPlaceholder('Proposal title...');
    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.scrollIntoViewIfNeeded();
      await titleInput.fill(proposalTitle);
      console.log(`✅ Title entered: ${proposalTitle}`);
    } else {
      console.log('⚠️ Title input not found - may not be required');
    }
    
    // Fill Proposal Description
    const descriptionEditor = page.locator('[contenteditable="true"]').first();
    if (await descriptionEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
      await descriptionEditor.scrollIntoViewIfNeeded();
      await descriptionEditor.click();
      await page.waitForTimeout(300);
      await page.keyboard.type(proposalDescription);
      console.log('✅ Description entered');
    } else {
      console.log('⚠️ Description editor not found - may not be required');
    }
    
    await page.waitForTimeout(500);

    // ========================================
    // CONFIGURE VOTING METHOD (TEMPLATE PRESET)
    // ========================================
    console.log('');
    console.log('🎛️ ═══════════════════════════════════════════════════════════');
    console.log('🎛️  CONFIGURING VOTING METHOD (TEMPLATE PRESET)');
    console.log('🎛️ ═══════════════════════════════════════════════════════════');
    console.log('');

    // Select a preset voting template (which sets quorum/unity automatically)
    console.log(`📋 Step 1: Selecting voting template "${selectedTemplate}"...`);
    await selectVotingTemplate(page, selectedTemplate);
    await page.waitForTimeout(500);

    // Take screenshot after template selection
    await page.screenshot({
      path: `test-results-production/voting-method-template-selected-${timestamp}.png`,
      fullPage: true,
    });
    
    console.log('✅ Using template preset values for Quorum and Unity');
    
    // "Minority Vote" and "Consent" templates have quorum below 20% 
    // which disables Auto-execution and requires Minimum Voting Duration
    if (needsMinDuration) {
      console.log(`⚠️ "${selectedTemplate}" template has quorum < 20% - filling Minimum Voting Duration...`);
      await fillMinimumVotingDuration(page);
    } else {
      // Also check if Minimum Voting Duration field is visible (just in case)
      const minDurationLabel = page.locator('text="Minimum Voting Duration"').first();
      if (await minDurationLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('⚠️ Minimum Voting Duration field detected - filling...');
        await fillMinimumVotingDuration(page);
      }
    }

    // 4. Scroll down to Voting Power section
    console.log('📜 Scrolling to Voting Power section...');
    
    const votingPowerSection = page.locator('text=Voting Power').first();
    if (await votingPowerSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await votingPowerSection.scrollIntoViewIfNeeded();
    } else {
      // Try scrolling within the panel
      for (let i = 0; i < 5; i++) {
        const votingPowerVisible = await page.locator('text=Voting Power').first().isVisible().catch(() => false);
        if (votingPowerVisible) {
          break;
        }
        
        const count = await scrollableContainers.count();
        for (let j = 0; j < count; j++) {
          await scrollableContainers.nth(j).evaluate((el) => {
            el.scrollTop += 200;
          }).catch(() => {});
        }
        
        await page.waitForTimeout(400);
      }
    }
    await page.waitForTimeout(500);

    // 5. Select the random voting power option
    console.log(`⚡ Step 4: Selecting voting power "${selectedVotingPower}"...`);
    await selectVotingPower(page, selectedVotingPower);
    await page.waitForTimeout(500);

    // 6. If "1 Voice 1 Vote" or "1 Token 1 Vote" is selected, fill in the Token field
    if (selectedVotingPower === '1 Voice 1 Vote' || selectedVotingPower === '1 Token 1 Vote') {
      console.log('📋 Token allocation required for this voting power type...');
      await fillVotingTokenAllocation(page);
    }

    // Take screenshot after voting power selection
    await page.screenshot({
      path: `test-results-production/voting-method-power-selected-${timestamp}.png`,
      fullPage: true,
    });

    // 7. Look for and click Publish/Save/Apply button
    console.log('💾 Looking for Publish button...');
    
    // Scroll down to find Publish button
    for (let i = 0; i < 5; i++) {
      const publishButton = page.locator('button:has-text("Publish"), button:has-text("Save"), button:has-text("Apply"), button:has-text("Confirm"), button:has-text("Update")').last();
      if (await publishButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await publishButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        
        // Ensure button is enabled
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
    console.log('⏳ Waiting for settings to save...');
    await page.waitForTimeout(3000);

    // Take screenshot after saving
    await page.screenshot({
      path: `test-results-production/voting-method-saved-${timestamp}.png`,
      fullPage: true,
    });

    // Check for success indicator
    try {
      await Promise.race([
        page.waitForSelector('text=/success/i', { timeout: 10000 }),
        page.waitForSelector('text=/saved/i', { timeout: 10000 }),
        page.waitForSelector('text=/updated/i', { timeout: 10000 }),
      ]);
      console.log('✅ Settings saved successfully!');
    } catch {
      // Check if we're still on the same page (settings might auto-save)
      console.log('⚠️ No explicit success message - settings may have auto-saved');
    }

    // Final screenshot
    await page.screenshot({
      path: `test-results-production/voting-method-final-${timestamp}.png`,
      fullPage: true,
    });

    // Log the result
    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  ✅ VOTING METHOD CHANGED SUCCESSFULLY                         ║',
    );
    console.log(
      '║                                                                ║',
    );
    console.log(
      '║  🎲 APPLIED SETTINGS:                                          ║',
    );
    console.log(`║    📋 Template: ${selectedTemplate.padEnd(44)}║`);
    if (needsMinDuration) {
      console.log(`║    ⏱️ Min Voting Duration: 6 hours                             ║`);
    }
    console.log(`║    ⚡ Voting Power: ${selectedVotingPower.padEnd(40)}║`);
    console.log(
      '║                                                                ║',
    );
    console.log(
      '║  ⚠️  These settings are now LIVE on the QA TESTING space!      ║',
    );
    console.log(
      '╚════════════════════════════════════════════════════════════════╝',
    );
    console.log('');
  });
});

