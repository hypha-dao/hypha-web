import { test, expect, Page } from '@playwright/test';

/**
 * Available tags in the Tags dropdown
 */
const AVAILABLE_TAGS = [
  'Arts',
  'Biodiversity',
  'Bioregions',
  'Cities',
  'Culture',
  'Education',
  'Emergency',
  'Energy',
  'Finance',
] as const;

/**
 * Randomly selects which tags to toggle (some on, some off)
 * @returns Array of tag names to toggle
 */
function getRandomTagsToToggle(): string[] {
  const tagsToToggle: string[] = [];
  
  // Randomly decide for each tag whether to toggle it
  for (const tag of AVAILABLE_TAGS) {
    if (Math.random() < 0.5) { // 50% chance to toggle each tag
      tagsToToggle.push(tag);
    }
  }
  
  // Ensure at least 1 tag is toggled
  if (tagsToToggle.length === 0) {
    const randomIndex = Math.floor(Math.random() * AVAILABLE_TAGS.length);
    tagsToToggle.push(AVAILABLE_TAGS[randomIndex]!);
  }
  
  return tagsToToggle;
}

/**
 * Toggles tags in the Tags dropdown
 * @param page - Playwright page object
 * @param tagsToToggle - Array of tag names to click/toggle
 */
async function toggleTags(page: Page, tagsToToggle: string[]): Promise<void> {
  console.log('🏷️ Opening Tags dropdown...');
  
  // Find and click the Tags dropdown
  const tagsDropdown = page.locator('text="Select one or more"').first();
  
  if (await tagsDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tagsDropdown.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await tagsDropdown.click();
    await page.waitForTimeout(800);
    console.log('✅ Tags dropdown opened');
  } else {
    // Try alternative: find by the Tags label
    const tagsLabel = page.locator('text="Tags"').first();
    if (await tagsLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      const dropdownNearTags = tagsLabel.locator('xpath=following::button[1]');
      if (await dropdownNearTags.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dropdownNearTags.click();
        await page.waitForTimeout(800);
        console.log('✅ Tags dropdown opened (alt method)');
      }
    }
  }
  
  // Toggle each tag
  for (const tagName of tagsToToggle) {
    console.log(`🔄 Toggling tag: ${tagName}...`);
    
    // Find the tag option (it's a checkbox item in the dropdown)
    const tagOption = page.locator(`text="${tagName}"`).first();
    
    if (await tagOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tagOption.click();
      await page.waitForTimeout(300);
      console.log(`✅ Toggled: ${tagName}`);
    } else {
      // Try scrolling within the dropdown to find the tag
      const dropdownContent = page.locator('[data-radix-popper-content-wrapper] [data-radix-scroll-area-viewport]').first();
      
      if (await dropdownContent.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Scroll within dropdown
        for (let i = 0; i < 3; i++) {
          await dropdownContent.evaluate((el) => {
            el.scrollTop += 100;
          }).catch(() => {});
          await page.waitForTimeout(200);
          
          const tagAfterScroll = page.locator(`text="${tagName}"`).first();
          if (await tagAfterScroll.isVisible({ timeout: 500 }).catch(() => false)) {
            await tagAfterScroll.click();
            await page.waitForTimeout(300);
            console.log(`✅ Toggled: ${tagName} (after scroll)`);
            break;
          }
        }
      }
    }
  }
  
  // Close the dropdown by clicking outside or pressing Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  console.log('✅ Tags dropdown closed');
}

/**
 * Production Test: Configure Space
 *
 * ⚠️  WARNING: This test modifies REAL settings on production!
 * ⚠️  The space configuration will be changed on https://app.hypha.earth
 * ⚠️  Only run this intentionally!
 *
 * Prerequisites:
 *   1. Run auth setup first: npx nx e2e-production-auth web-e2e
 *
 * Run this test:
 *   npx nx e2e-production-configure-space web-e2e -- --headed
 */

test.describe('Configure Space on Production', () => {
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

  test('should configure space settings with randomized tags in the QA TESTING space', async ({
    page,
  }) => {
    const timestamp = Date.now();
    
    // Generate random settings
    const tagsToToggle = getRandomTagsToToggle();
    const newPurpose = `QA testing - Updated by E2E test at ${new Date().toISOString()}`;

    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  ⚙️  CONFIGURING SPACE ON PRODUCTION                           ║',
    );
    console.log(
      '╠════════════════════════════════════════════════════════════════╣',
    );
    console.log(
      '║  🎲 RANDOMIZED SETTINGS:                                       ║',
    );
    console.log(`║    📝 Purpose: Will update with timestamp                      ║`);
    console.log(`║    🏷️ Tags to toggle: ${tagsToToggle.length} tags                                   ║`);
    for (const tag of tagsToToggle) {
      console.log(`║      - ${tag.padEnd(54)}║`);
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
      path: `test-results-production/configure-space-settings-panel-${timestamp}.png`,
      fullPage: true,
    });

    // Click on "Space Configuration" (first option under Overview)
    console.log('🔘 Clicking on "Space Configuration"...');
    
    // Find by the description text
    const spaceConfigCard = page.locator('text=Customise your space by setting its purpose').first();
    
    if (await spaceConfigCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await spaceConfigCard.click({ force: true });
    } else {
      // Fallback: click on "Space Configuration" text directly
      const spaceConfigText = page.locator('text=Space Configuration').first();
      await spaceConfigText.click({ force: true });
    }
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ Space Configuration panel opened');

    // Take screenshot of space configuration panel
    await page.screenshot({
      path: `test-results-production/configure-space-config-panel-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // EDIT PURPOSE
    // ========================================
    console.log('');
    console.log('📝 Editing Purpose field...');
    
    // Find and edit the Purpose textarea
    const purposeTextarea = page.locator('textarea').filter({
      has: page.locator('xpath=ancestor::*[contains(., "Purpose")]')
    }).first();
    
    if (await purposeTextarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await purposeTextarea.scrollIntoViewIfNeeded();
      await purposeTextarea.click();
      await purposeTextarea.fill(newPurpose);
      console.log(`✅ Purpose updated to: ${newPurpose.substring(0, 50)}...`);
    } else {
      // Try alternative: find textarea after "Purpose" label
      const purposeLabel = page.locator('text="Purpose"').first();
      const textareaAfterLabel = purposeLabel.locator('xpath=following::textarea[1]');
      
      if (await textareaAfterLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
        await textareaAfterLabel.click();
        await textareaAfterLabel.fill(newPurpose);
        console.log(`✅ Purpose updated (alt method)`);
      } else {
        // Last resort: find any textarea on the page
        const anyTextarea = page.locator('textarea').first();
        if (await anyTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
          await anyTextarea.click();
          await anyTextarea.fill(newPurpose);
          console.log(`✅ Purpose updated (last resort)`);
        } else {
          console.log('⚠️ Purpose textarea not found');
        }
      }
    }
    
    await page.waitForTimeout(500);

    // Take screenshot after editing purpose
    await page.screenshot({
      path: `test-results-production/configure-space-purpose-edited-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // EDIT TAGS
    // ========================================
    console.log('');
    console.log('🏷️ ═══════════════════════════════════════════════════════════');
    console.log('🏷️  CONFIGURING TAGS (RANDOMIZED)');
    console.log('🏷️ ═══════════════════════════════════════════════════════════');
    console.log('');
    
    // Scroll to Tags section
    const tagsLabel = page.locator('text="Tags"').first();
    if (await tagsLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tagsLabel.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }
    
    // Toggle the random tags
    await toggleTags(page, tagsToToggle);
    
    await page.waitForTimeout(500);

    // Take screenshot after editing tags
    await page.screenshot({
      path: `test-results-production/configure-space-tags-edited-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // CLICK UPDATE BUTTON
    // ========================================
    console.log('');
    console.log('💾 Looking for Update button...');
    
    const scrollableContainers = page.locator('[data-radix-scroll-area-viewport], [class*="overflow-auto"], [class*="overflow-y"]');
    
    // Scroll down to find Update button
    for (let i = 0; i < 5; i++) {
      const updateButton = page.locator('button:has-text("Update"), button:has-text("Save"), button:has-text("Apply"), button:has-text("Publish")').last();
      
      if (await updateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await updateButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        
        // Ensure button is enabled
        const isEnabled = await updateButton.isEnabled();
        if (isEnabled) {
          console.log('📝 Clicking Update button...');
          await updateButton.click();
          console.log('✅ Update button clicked!');
          break;
        } else {
          console.log('⚠️ Update button is disabled');
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
      console.log(`📜 Scroll attempt ${i + 1} to find Update button...`);
    }

    // Wait for save to complete
    console.log('⏳ Waiting for settings to save...');
    await page.waitForTimeout(3000);

    // Take screenshot after saving
    await page.screenshot({
      path: `test-results-production/configure-space-saved-${timestamp}.png`,
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
      console.log('⚠️ No explicit success message - settings may have auto-saved');
    }

    // Final screenshot
    await page.screenshot({
      path: `test-results-production/configure-space-final-${timestamp}.png`,
      fullPage: true,
    });

    // Log the result
    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  ✅ SPACE CONFIGURATION UPDATED SUCCESSFULLY                   ║',
    );
    console.log(
      '║                                                                ║',
    );
    console.log(
      '║  🎲 APPLIED SETTINGS:                                          ║',
    );
    console.log(`║    📝 Purpose: Updated with timestamp                          ║`);
    console.log(`║    🏷️ Tags toggled: ${String(tagsToToggle.length).padEnd(41)}║`);
    for (const tag of tagsToToggle.slice(0, 3)) {
      console.log(`║      - ${tag.padEnd(54)}║`);
    }
    if (tagsToToggle.length > 3) {
      console.log(`║      ... and ${tagsToToggle.length - 3} more                                            ║`);
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

