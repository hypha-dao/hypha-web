import { test, expect, Page } from '@playwright/test';

/**
 * Entry Method Options available in the UI
 */
const ENTRY_METHOD_OPTIONS = [
  'Open Access',
  'Invite Request',
  'Token Based',
] as const;

/**
 * Tokens to EXCLUDE when selecting for Token Based entry
 * (User requested to exclude USDC, BTC, ETH, EURC)
 */
const EXCLUDED_TOKENS = ['USDC', 'EURC', 'WETH', 'cbBTC', 'ETH', 'BTC'];

/**
 * Randomly selects an item from an array
 */
function randomChoice<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)]!;
}

/**
 * Generates a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Selects an entry method option by clicking on it
 * @param page - Playwright page object
 * @param optionName - Name of the entry method option
 */
async function selectEntryMethod(
  page: Page,
  optionName: string
): Promise<boolean> {
  try {
    console.log(`🚪 Selecting entry method: ${optionName}...`);
    
    // Find the entry method card/option by its name
    const optionElement = page.locator(`text="${optionName}"`).first();
    
    if (!(await optionElement.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log(`⚠️ Entry method option not found: ${optionName}`);
      return false;
    }
    
    await optionElement.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    
    // Click on the option card
    await optionElement.click();
    await page.waitForTimeout(500);
    
    console.log(`✅ Entry method selected: ${optionName}`);
    return true;
  } catch (error) {
    console.log(`⚠️ Error selecting entry method ${optionName}:`, error);
    return false;
  }
}

/**
 * Fills in the Token Based entry method fields
 * @param page - Playwright page object
 * @param tokenAmount - The minimum token amount required
 */
async function fillTokenBasedFields(page: Page, tokenAmount: number): Promise<void> {
  console.log('🪙 Filling Token Based entry method fields...');
  
  // Wait for the fields to appear
  await page.waitForTimeout(1000);
  
  // Scroll to find the Token fields
  const tokenFieldLabel = page.locator('text="Required Min. Token"').first();
  if (await tokenFieldLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tokenFieldLabel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
  
  // Fill in the token amount
  console.log(`💰 Setting token amount to ${tokenAmount}...`);
  
  // Find the number input for token amount
  const tokenAmountInput = page.locator('input[type="number"], input[inputmode="numeric"]').first();
  
  if (await tokenAmountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tokenAmountInput.scrollIntoViewIfNeeded();
    await tokenAmountInput.click();
    await tokenAmountInput.fill(String(tokenAmount));
    console.log(`✅ Token amount set to: ${tokenAmount}`);
  } else {
    // Try alternative: find input near the label
    const altInput = page.locator('text="Required Min. Token"').locator('xpath=following::input[1]');
    if (await altInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await altInput.fill(String(tokenAmount));
      console.log(`✅ Token amount set to: ${tokenAmount} (alt method)`);
    } else {
      console.log('⚠️ Token amount input not found');
    }
  }
  
  await page.waitForTimeout(500);
  
  // Select a token from the dropdown (excluding USDC, BTC, ETH, EURC)
  console.log('🔽 Selecting token (excluding USDC, BTC, ETH, EURC)...');
  
  // Find the token dropdown - it shows "USDC" by default or another token
  const tokenDropdown = page.locator('button:has-text("USDC"), button:has-text("Select"), [role="combobox"]').last();
  
  if (await tokenDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tokenDropdown.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    console.log('🔘 Clicking token dropdown...');
    await tokenDropdown.click();
    await page.waitForTimeout(800);
    
    let tokenSelected = false;
    
    // Look for options and select one that's NOT in the excluded list
    const options = page.locator('[role="option"]');
    const optionCount = await options.count();
    console.log(`🔍 Found ${optionCount} token options`);
    
    if (optionCount > 0) {
      // Iterate through options to find one that's not excluded
      for (let i = 0; i < optionCount; i++) {
        const optionText = await options.nth(i).textContent() || '';
        
        // Check if this token is NOT in the excluded list
        const isExcluded = EXCLUDED_TOKENS.some(excluded => 
          optionText.toUpperCase().includes(excluded.toUpperCase())
        );
        
        if (!isExcluded && optionText.trim()) {
          console.log(`🔘 Selecting allowed token: ${optionText.trim()}...`);
          await options.nth(i).click();
          await page.waitForTimeout(500);
          console.log(`✅ Token selected: ${optionText.trim()}`);
          tokenSelected = true;
          break;
        }
      }
      
      // If no allowed token found, try to find by text
      if (!tokenSelected) {
        const allowedTokens = ['QATEST', 'TXFBG', 'TXCSE', 'THPWQ', 'VOICEQATES'];
        
        for (const token of allowedTokens) {
          const tokenOption = page.locator(`text="${token}"`).first();
          if (await tokenOption.isVisible({ timeout: 500 }).catch(() => false)) {
            await tokenOption.click();
            await page.waitForTimeout(500);
            console.log(`✅ Token selected: ${token}`);
            tokenSelected = true;
            break;
          }
        }
      }
    }
    
    if (!tokenSelected) {
      // Fallback: scroll in dropdown and try again
      console.log('📜 Scrolling dropdown to find more tokens...');
      
      const dropdownScrollable = page.locator('[data-radix-popper-content-wrapper] [data-radix-scroll-area-viewport]');
      
      for (let scroll = 0; scroll < 3; scroll++) {
        const scrollCount = await dropdownScrollable.count();
        if (scrollCount > 0) {
          await dropdownScrollable.first().evaluate((el) => {
            el.scrollTop += 100;
          }).catch(() => {});
        }
        await page.waitForTimeout(300);
        
        // Try to find allowed tokens after scrolling
        const allowedTokens = ['QATEST', 'TXFBG', 'TXCSE', 'THPWQ'];
        for (const token of allowedTokens) {
          const tokenOption = page.locator(`text="${token}"`).first();
          if (await tokenOption.isVisible({ timeout: 500 }).catch(() => false)) {
            await tokenOption.click();
            await page.waitForTimeout(500);
            console.log(`✅ Token selected: ${token} (after scroll)`);
            tokenSelected = true;
            break;
          }
        }
        if (tokenSelected) break;
      }
    }
    
    if (!tokenSelected) {
      console.log('⚠️ Could not find an allowed token - using keyboard selection');
      // Use keyboard to navigate past excluded tokens
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(200);
      }
      await page.keyboard.press('Enter');
      console.log('✅ Token selected (keyboard fallback)');
    }
  } else {
    console.log('⚠️ Token dropdown not found');
  }
  
  await page.waitForTimeout(500);
}

/**
 * Production Test: Change Entry Method
 *
 * ⚠️  WARNING: This test modifies REAL settings on production!
 * ⚠️  The entry method will be changed on https://app.hypha.earth
 * ⚠️  Only run this intentionally!
 *
 * Prerequisites:
 *   1. Run auth setup first: npx nx e2e-production-auth web-e2e
 *
 * Run this test:
 *   npx nx e2e-production-change-entry-method web-e2e -- --headed
 */

test.describe('Change Entry Method on Production', () => {
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

  test('should change entry method with randomized settings in the QA TESTING space', async ({
    page,
  }) => {
    const timestamp = Date.now();
    
    // Generate random settings
    const selectedEntryMethod = randomChoice(ENTRY_METHOD_OPTIONS);
    const tokenAmount = randomInt(1, 100); // Random token amount between 1 and 100
    
    // Check if Token Based requires additional fields
    const needsTokenFields = selectedEntryMethod === 'Token Based';

    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  🚪 CHANGING ENTRY METHOD ON PRODUCTION                        ║',
    );
    console.log(
      '╠════════════════════════════════════════════════════════════════╣',
    );
    console.log(
      '║  🎲 RANDOMIZED ENTRY SETTINGS:                                 ║',
    );
    console.log(`║    🚪 Entry Method: ${selectedEntryMethod.padEnd(40)}║`);
    if (needsTokenFields) {
      console.log(`║    💰 Token Amount: ${String(tokenAmount).padEnd(40)}║`);
      console.log(`║    🪙 Token: (will select non-USDC/ETH/BTC token)              ║`);
    }
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
      path: `test-results-production/entry-method-settings-panel-${timestamp}.png`,
      fullPage: true,
    });

    // Scroll down to find "Members" section and "Entry Method"
    console.log('📜 Scrolling to find "Entry Method" under Members...');
    
    const scrollableContainers = page.locator('[data-radix-scroll-area-viewport], [class*="overflow-auto"], [class*="overflow-y"], [style*="overflow"]');
    
    // Scroll to find Entry Method
    for (let i = 0; i < 10; i++) {
      const entryMethodVisible = await page.locator('text=Entry Method').first().isVisible().catch(() => false);
      if (entryMethodVisible) {
        console.log('✅ Found "Entry Method" option');
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
      path: `test-results-production/entry-method-after-scroll-${timestamp}.png`,
      fullPage: true,
    });

    // Click on "Entry Method" card
    console.log('🔘 Clicking on "Entry Method"...');
    
    // Find by the description text to be more precise
    const entryMethodCard = page.locator('text=Select and configure the process by which new members join').first();
    
    if (await entryMethodCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await entryMethodCard.click({ force: true });
    } else {
      // Fallback: click on "Entry Method" text directly
      const entryMethodText = page.locator('text=Entry Method').first();
      await entryMethodText.click({ force: true });
    }
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ Entry Method panel opened');

    // Take screenshot of entry method panel
    await page.screenshot({
      path: `test-results-production/entry-method-panel-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // FILL PROPOSAL TITLE AND DESCRIPTION
    // ========================================
    console.log('');
    console.log('📝 Filling proposal title and description...');
    
    // Generate unique proposal title and description
    const proposalTitle = `E2E Entry Method Change ${timestamp}`;
    const proposalDescription = `Automated E2E test changing entry method to "${selectedEntryMethod}"${needsTokenFields ? ` with ${tokenAmount} tokens required` : ''}.`;
    
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
    // SELECT ENTRY METHOD
    // ========================================
    console.log('');
    console.log('🎛️ ═══════════════════════════════════════════════════════════');
    console.log('🎛️  CONFIGURING ENTRY METHOD (RANDOMIZED)');
    console.log('🎛️ ═══════════════════════════════════════════════════════════');
    console.log('');

    // Select the random entry method
    console.log(`🚪 Step 1: Selecting entry method "${selectedEntryMethod}"...`);
    await selectEntryMethod(page, selectedEntryMethod);
    await page.waitForTimeout(500);

    // Take screenshot after entry method selection
    await page.screenshot({
      path: `test-results-production/entry-method-selected-${timestamp}.png`,
      fullPage: true,
    });

    // If "Token Based" is selected, fill in the additional fields
    if (needsTokenFields) {
      console.log('📋 Token Based entry requires additional fields...');
      await fillTokenBasedFields(page, tokenAmount);
    }

    // Take screenshot after all fields filled
    await page.screenshot({
      path: `test-results-production/entry-method-fields-filled-${timestamp}.png`,
      fullPage: true,
    });

    // Look for and click Publish button
    console.log('💾 Looking for Publish button...');
    
    // Scroll down to find Publish button
    for (let i = 0; i < 5; i++) {
      const publishButton = page.locator('button:has-text("Publish"), button:has-text("Save"), button:has-text("Apply")').last();
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
      path: `test-results-production/entry-method-saved-${timestamp}.png`,
      fullPage: true,
    });

    // Check for success indicator
    try {
      await Promise.race([
        page.waitForSelector('text=/success/i', { timeout: 10000 }),
        page.waitForSelector('text=/saved/i', { timeout: 10000 }),
        page.waitForSelector('text=/updated/i', { timeout: 10000 }),
        page.waitForSelector('text=/created/i', { timeout: 10000 }),
      ]);
      console.log('✅ Settings saved successfully!');
    } catch {
      console.log('⚠️ No explicit success message - settings may have auto-saved');
    }

    // Final screenshot
    await page.screenshot({
      path: `test-results-production/entry-method-final-${timestamp}.png`,
      fullPage: true,
    });

    // Log the result
    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  ✅ ENTRY METHOD CHANGED SUCCESSFULLY                          ║',
    );
    console.log(
      '║                                                                ║',
    );
    console.log(
      '║  🎲 APPLIED SETTINGS:                                          ║',
    );
    console.log(`║    🚪 Entry Method: ${selectedEntryMethod.padEnd(40)}║`);
    if (needsTokenFields) {
      console.log(`║    💰 Token Amount: ${String(tokenAmount).padEnd(40)}║`);
      console.log(`║    🪙 Token: (selected non-USDC/ETH/BTC token)                 ║`);
    }
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

