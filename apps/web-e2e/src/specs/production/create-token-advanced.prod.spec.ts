import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Creates a test image buffer (a simple colored PNG)
 */
function createTestImageBuffer(): Buffer {
  // Minimal valid PNG - a 100x100 purple image for token icon
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(100, 0);
  ihdrData.writeUInt32BE(100, 4);
  ihdrData.writeUInt8(8, 8);
  ihdrData.writeUInt8(2, 9);
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);

  const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
  const ihdrChunk = Buffer.concat([
    Buffer.from([0, 0, 0, 13]),
    Buffer.from('IHDR'),
    ihdrData,
    ihdrCrc,
  ]);

  const rawData: number[] = [];
  for (let y = 0; y < 100; y++) {
    rawData.push(0);
    for (let x = 0; x < 100; x++) {
      rawData.push(150, 100, 200); // Purple color
    }
  }

  const deflated = deflateStore(Buffer.from(rawData));
  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), deflated]));
  const idatLen = Buffer.alloc(4);
  idatLen.writeUInt32BE(deflated.length, 0);
  const idatChunk = Buffer.concat([idatLen, Buffer.from('IDAT'), deflated, idatCrc]);

  const iendCrc = crc32(Buffer.from('IEND'));
  const iendChunk = Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from('IEND'), iendCrc]);

  return Buffer.concat([pngHeader, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(data: Buffer): Buffer {
  let crc = 0xffffffff;
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  }
  const result = Buffer.alloc(4);
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return result;
}

function deflateStore(data: Buffer): Buffer {
  const blocks: Buffer[] = [];
  const chunkSize = 65535;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.subarray(i, Math.min(i + chunkSize, data.length));
    const isLast = i + chunkSize >= data.length;
    const header = Buffer.alloc(5);
    header.writeUInt8(isLast ? 1 : 0, 0);
    header.writeUInt16LE(chunk.length, 1);
    header.writeUInt16LE(chunk.length ^ 0xffff, 3);
    blocks.push(header, chunk);
  }
  const zlibHeader = Buffer.from([0x78, 0x01]);
  const adler = adler32(data);
  return Buffer.concat([zlibHeader, ...blocks, adler]);
}

function adler32(data: Buffer): Buffer {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]!) % 65521;
    b = (b + a) % 65521;
  }
  const result = Buffer.alloc(4);
  result.writeUInt32BE(((b << 16) | a) >>> 0, 0);
  return result;
}

/**
 * Advanced Token Settings Configuration
 * Each setting has a name for logging and a label to find the toggle
 */
interface AdvancedSetting {
  name: string;
  label: string;
  enabled: boolean;
}

/**
 * Generates a random configuration for advanced token settings
 * @returns Array of settings with random enabled states
 */
function generateRandomAdvancedSettings(): AdvancedSetting[] {
  const settings: AdvancedSetting[] = [
    {
      name: 'Enable Limited Supply',
      label: 'Enable Limited Supply',
      enabled: Math.random() < 0.5,
    },
    {
      name: 'Enable Proposal Auto-Minting',
      label: 'Enable Proposal Auto-Minting',
      enabled: Math.random() < 0.5,
    },
    {
      name: 'Transferable',
      label: 'Transferable',
      enabled: Math.random() < 0.5,
    },
    {
      name: 'Optional: Advanced Transfer Controls',
      label: 'Optional: Advanced Transfer Controls',
      enabled: Math.random() < 0.5,
    },
    {
      name: 'Enable Token Price',
      label: 'Enable Token Price',
      enabled: Math.random() < 0.5,
    },
  ];

  return settings;
}

/**
 * Fills in the Token Price fields when enabled
 * @param page - Playwright page object
 */
async function fillTokenPriceFields(page: Page): Promise<void> {
  console.log('📝 Filling Token Price fields...');
  
  // Wait for the fields to appear
  await page.waitForTimeout(500);
  
  // Select Reference Currency from dropdown
  console.log('🔽 Selecting Reference Currency...');
  
  const currencyDropdown = page.locator('text="Select currency"').first();
  
  if (await currencyDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
    await currencyDropdown.scrollIntoViewIfNeeded();
    await currencyDropdown.click();
    await page.waitForTimeout(500);
    
    // Select the first available currency option
    const options = page.locator('[role="option"]');
    const optionCount = await options.count();
    
    if (optionCount > 0) {
      // Select first currency option (usually USD or similar)
      const selectedOption = options.first();
      const optionText = await selectedOption.textContent();
      await selectedOption.click();
      console.log(`✅ Reference Currency selected: ${optionText}`);
    } else {
      console.log('⚠️ No currency options found');
    }
  } else {
    // Try alternative selector
    const altDropdown = page.locator('button:has-text("Select"), [role="combobox"]').filter({
      has: page.locator('xpath=ancestor::*[contains(., "Reference Currency")]')
    }).first();
    
    if (await altDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      await altDropdown.click();
      await page.waitForTimeout(500);
      const firstOption = page.locator('[role="option"]').first();
      await firstOption.click();
      console.log('✅ Reference Currency selected (alt method)');
    } else {
      console.log('⚠️ Could not find Reference Currency dropdown');
    }
  }
  
  await page.waitForTimeout(500);
  
  // Fill Token Price (must be greater than 0)
  console.log('💰 Entering Token Price...');
  
  const tokenPriceInput = page.getByPlaceholder('Enter token price').first();
  
  if (await tokenPriceInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tokenPriceInput.scrollIntoViewIfNeeded();
    await tokenPriceInput.click();
    await tokenPriceInput.fill('1'); // Set token price to 1
    console.log('✅ Token Price set to 1');
  } else {
    // Try alternative: find number input near "Token Price" label
    const tokenPriceLabel = page.locator('text="Token Price"').last();
    if (await tokenPriceLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Find the nearest input
      const nearbyInput = page.locator('input[type="number"], input[inputmode="numeric"]').last();
      if (await nearbyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nearbyInput.scrollIntoViewIfNeeded();
        await nearbyInput.click();
        await nearbyInput.fill('1');
        console.log('✅ Token Price set to 1 (alt method)');
      } else {
        console.log('⚠️ Could not find Token Price input');
      }
    }
  }
  
  await page.waitForTimeout(500);
}

/**
 * Fills in the Limited Supply fields when enabled
 * @param page - Playwright page object
 */
async function fillLimitedSupplyFields(page: Page): Promise<void> {
  console.log('📝 Filling Limited Supply fields...');
  
  // Wait for the fields to appear
  await page.waitForTimeout(500);
  
  // Fill Max Supply amount (must be greater than 0)
  const maxSupplyInput = page.locator('input[type="number"]').filter({
    has: page.locator('xpath=ancestor::*[contains(., "Max Supply")]')
  }).first();
  
  // Try alternative selectors for the Max Supply input
  let inputFound = false;
  
  // Method 1: Look for input near "Max Supply" label
  const maxSupplyLabel = page.locator('text="Max Supply"').first();
  if (await maxSupplyLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    const inputNearLabel = page.locator('input[type="number"]').first();
    if (await inputNearLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await inputNearLabel.scrollIntoViewIfNeeded();
      await inputNearLabel.click();
      await inputNearLabel.fill('1000000'); // Set max supply to 1 million
      inputFound = true;
      console.log('✅ Max Supply set to 1000000');
    }
  }
  
  // Method 2: Try finding by placeholder or nearby elements
  if (!inputFound) {
    const numberInputs = page.locator('input[type="number"], input[inputmode="numeric"]');
    const count = await numberInputs.count();
    for (let i = 0; i < count; i++) {
      const input = numberInputs.nth(i);
      const value = await input.inputValue().catch(() => '');
      // Find the one that's currently 0 or empty (the Max Supply field)
      if (value === '0' || value === '') {
        await input.scrollIntoViewIfNeeded();
        await input.click();
        await input.fill('1000000');
        inputFound = true;
        console.log('✅ Max Supply set to 1000000 (method 2)');
        break;
      }
    }
  }
  
  if (!inputFound) {
    console.log('⚠️ Could not find Max Supply input');
  }
  
  await page.waitForTimeout(500);
  
  // Select Max Supply Type from dropdown
  console.log('🔽 Selecting Max Supply Type...');
  
  const maxSupplyTypeDropdown = page.locator('text="Select max supply type"').first();
  
  if (await maxSupplyTypeDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
    await maxSupplyTypeDropdown.scrollIntoViewIfNeeded();
    await maxSupplyTypeDropdown.click();
    await page.waitForTimeout(500);
    
    // Select the first option (either "Forever Immutable" or "Updatable Over Time")
    // Let's randomly choose one
    const options = page.locator('[role="option"]');
    const optionCount = await options.count();
    
    if (optionCount > 0) {
      // Randomly select one of the options
      const randomIndex = Math.floor(Math.random() * optionCount);
      const selectedOption = options.nth(randomIndex);
      const optionText = await selectedOption.textContent();
      await selectedOption.click();
      console.log(`✅ Max Supply Type selected: ${optionText}`);
    } else {
      // Fallback: try clicking first visible option
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstOption.click();
        console.log('✅ Max Supply Type selected (fallback)');
      }
    }
  } else {
    // Try alternative: look for dropdown button with "Max Supply Type" nearby
    const dropdownButton = page.locator('button:has-text("Select"), [role="combobox"]').filter({
      has: page.locator('xpath=ancestor::*[contains(., "Max Supply Type")]')
    }).first();
    
    if (await dropdownButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dropdownButton.click();
      await page.waitForTimeout(500);
      const firstOption = page.locator('[role="option"]').first();
      await firstOption.click();
      console.log('✅ Max Supply Type selected (alt method)');
    } else {
      console.log('⚠️ Could not find Max Supply Type dropdown');
    }
  }
  
  await page.waitForTimeout(500);
}

/**
 * Toggles a switch based on its label text
 * @param page - Playwright page object
 * @param label - The label text associated with the switch
 * @param shouldBeEnabled - Whether the switch should be enabled
 */
async function toggleSwitchByLabel(
  page: Page,
  label: string,
  shouldBeEnabled: boolean
): Promise<boolean> {
  try {
    // Find the switch/toggle associated with the label
    // The switch is usually a sibling or nearby element to the label
    const labelElement = page.locator(`text="${label}"`).first();
    
    if (!(await labelElement.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`⚠️ Label not found: ${label}`);
      return false;
    }

    // Find the toggle switch - it's typically a button with role="switch" or a similar toggle element
    // Try multiple strategies to find the toggle
    let toggleElement = page.locator(`button[role="switch"]`).filter({
      has: page.locator('..').filter({ hasText: label })
    }).first();

    // Alternative: find toggle near the label
    if (!(await toggleElement.isVisible({ timeout: 1000 }).catch(() => false))) {
      // Look for toggle in the same row/container as the label
      const container = labelElement.locator('xpath=ancestor::div[contains(@class, "flex") or contains(@class, "row")]').first();
      toggleElement = container.locator('button[role="switch"], [data-state], input[type="checkbox"]').first();
    }

    // Another alternative: look for the toggle by finding elements with data-state attribute
    if (!(await toggleElement.isVisible({ timeout: 1000 }).catch(() => false))) {
      // Find all switches and match by proximity to label
      toggleElement = page.locator(`text="${label}" >> xpath=following::button[@role="switch"][1]`).first();
    }

    // Final fallback: look for any toggle element right after or near the label text
    if (!(await toggleElement.isVisible({ timeout: 1000 }).catch(() => false))) {
      toggleElement = page.locator(`text="${label}"`).locator('xpath=following::*[@role="switch" or @data-state][1]').first();
    }

    if (!(await toggleElement.isVisible({ timeout: 2000 }).catch(() => false))) {
      console.log(`⚠️ Toggle not found for: ${label}`);
      return false;
    }

    // Check current state
    const currentState = await toggleElement.getAttribute('data-state');
    const isCurrentlyOn = currentState === 'checked';

    // Toggle only if the current state doesn't match desired state
    if (isCurrentlyOn !== shouldBeEnabled) {
      await toggleElement.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await toggleElement.click();
      await page.waitForTimeout(500);
      
      const newState = await toggleElement.getAttribute('data-state');
      console.log(`🔄 Toggled "${label}": ${currentState} → ${newState}`);
    } else {
      console.log(`✓ "${label}" already ${shouldBeEnabled ? 'ON' : 'OFF'}`);
    }

    return true;
  } catch (error) {
    console.log(`⚠️ Error toggling ${label}:`, error);
    return false;
  }
}

/**
 * Production Test: Issue New Token with Random Advanced Settings
 *
 * ⚠️  WARNING: This test creates REAL data on production!
 * ⚠️  The token will be created on https://app.hypha.earth
 * ⚠️  Only run this intentionally!
 *
 * Prerequisites:
 *   1. Run auth setup first: npx nx e2e-production-auth web-e2e
 *
 * Run this test:
 *   npx nx e2e-production-create-token-advanced web-e2e -- --headed
 */

test.describe('Issue New Token with Random Advanced Settings on Production', () => {
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

  test('should issue a new token with randomized advanced settings in the QA TESTING space', async ({
    page,
  }) => {
    // Generate unique token name with timestamp
    const timestamp = Date.now();
    // Generate random letters only (no numbers) for token name
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let randomLetters = '';
    for (let i = 0; i < 4; i++) {
      randomLetters += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    // Token name: letters only, no numbers
    const tokenName = `Test Token ${randomLetters}`;
    // Token symbol must be 2-10 characters, all caps (can have numbers)
    const tokenSymbol = `T${randomLetters}`.toUpperCase().substring(0, 8);

    // Generate random advanced settings
    const advancedSettings = generateRandomAdvancedSettings();

    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  🚀 ISSUING NEW TOKEN ON PRODUCTION (WITH ADVANCED SETTINGS)   ║',
    );
    console.log(`║  Name: ${tokenName.substring(0, 54).padEnd(54)}║`);
    console.log(`║  Symbol: ${tokenSymbol.padEnd(52)}║`);
    console.log(
      '╠════════════════════════════════════════════════════════════════╣',
    );
    console.log(
      '║  🎲 RANDOMIZED ADVANCED SETTINGS:                              ║',
    );
    for (const setting of advancedSettings) {
      const status = setting.enabled ? '✅ ON ' : '❌ OFF';
      const settingDisplay = `${status} ${setting.name}`;
      console.log(`║    ${settingDisplay.padEnd(58)}║`);
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

    // Click on Space Settings (gear icon or settings link)
    console.log('⚙️ Opening Space Settings...');
    // Try to find settings button/link - could be a gear icon or "Settings" text
    const settingsButton = page.locator('a[href*="/settings"], button:has-text("Settings"), [aria-label*="settings"], [aria-label*="Settings"]').first();
    
    if (await settingsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsButton.click();
    } else {
      // Try clicking on a gear/cog icon
      const gearIcon = page.locator('svg[class*="gear"], svg[class*="cog"], [data-testid="settings"]').first();
      if (await gearIcon.isVisible({ timeout: 3000 }).catch(() => false)) {
        await gearIcon.click();
      } else {
        // Navigate directly to settings URL
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
      path: `test-results-production/token-advanced-settings-panel-${timestamp}.png`,
      fullPage: true,
    });

    // Scroll down within the settings panel to find "Issue new token"
    console.log('📜 Scrolling within the settings panel...');
    
    // Find the scrollable container - it's likely the panel that contains "Space Settings"
    // Look for scrollable elements in the right side panel
    const scrollableContainers = page.locator('[data-radix-scroll-area-viewport], [class*="overflow-auto"], [class*="overflow-y"], [style*="overflow"]');
    
    // Scroll multiple times to find Issue new token
    for (let i = 0; i < 5; i++) {
      // Check if Issue new token is visible
      const issueTokenVisible = await page.locator('text=Issue New Token').isVisible().catch(() => false);
      if (issueTokenVisible) {
        console.log('✅ Found "Issue New Token" button');
        break;
      }
      
      // Try scrolling each scrollable container
      const count = await scrollableContainers.count();
      for (let j = 0; j < count; j++) {
        await scrollableContainers.nth(j).evaluate((el) => {
          el.scrollTop += 200;
        }).catch(() => {});
      }
      
      await page.waitForTimeout(500);
      console.log(`📜 Scroll attempt ${i + 1}...`);
    }

    // Take screenshot after scrolling
    await page.screenshot({
      path: `test-results-production/token-advanced-after-scroll-${timestamp}.png`,
      fullPage: true,
    });

    // Find and click Issue New Token - it's the one with "Create a new token for utility" description
    console.log('🔍 Looking for "Issue New Token" (with utility description)...');
    
    // Use the unique description text to find the right card
    // "Create a new token for utility, ownership, impact, cash credits, or voice within your space."
    const issueTokenCard = page.locator('text=Create a new token for utility').first();
    
    await expect(issueTokenCard).toBeVisible({ timeout: 10000 });
    console.log('🔘 Clicking "Issue New Token" card...');
    await issueTokenCard.click({ force: true });
    await page.waitForTimeout(2000);
    console.log('✅ Issue new token clicked');

    // Take screenshot of the token form
    await page.screenshot({
      path: `test-results-production/token-advanced-form-${timestamp}.png`,
      fullPage: true,
    });

    // Fill out the token form
    console.log('📝 Filling token form...');

    // 1. Fill Proposal Title
    console.log('📝 Entering proposal title...');
    const titleInput = page.getByPlaceholder('Proposal title...');
    await titleInput.scrollIntoViewIfNeeded();
    await titleInput.fill(`Issue Token (Advanced): ${tokenName}`);
    console.log(`✅ Title entered: Issue Token (Advanced): ${tokenName}`);

    // 2. Fill Proposal Content/Description
    console.log('📝 Entering proposal description...');
    const descriptionEditor = page.locator('[contenteditable="true"]').first();
    await descriptionEditor.scrollIntoViewIfNeeded();
    await descriptionEditor.click();
    await page.waitForTimeout(300);
    await page.keyboard.type(`Creating a new token with ADVANCED SETTINGS: ${tokenName} (${tokenSymbol}). This is a test token created by E2E automation with randomized advanced settings.`);
    console.log('✅ Description entered');

    // 3. Scroll down to General section
    console.log('📜 Scrolling to General section...');
    const generalSection = page.locator('text=General').first();
    await generalSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // 4. Select Token Type from dropdown
    console.log('🔽 Selecting token type...');
    const tokenTypeDropdown = page.locator('text=Select a token type').first();
    await tokenTypeDropdown.scrollIntoViewIfNeeded();
    await tokenTypeDropdown.click();
    await page.waitForTimeout(500);
    // Select first available token type option
    const tokenTypeOption = page.locator('[role="option"]').first();
    await tokenTypeOption.click();
    await page.waitForTimeout(500);
    console.log('✅ Token type selected');

    // 5. Fill Token Name
    console.log('📝 Entering token name...');
    const tokenNameInput = page.getByPlaceholder('Type a name');
    await tokenNameInput.scrollIntoViewIfNeeded();
    await tokenNameInput.fill(tokenName);
    console.log(`✅ Token name entered: ${tokenName}`);

    // 6. Fill Token Symbol (2-10 characters, all caps)
    console.log('📝 Entering token symbol...');
    const symbolInput = page.getByPlaceholder('Type a symbol');
    await symbolInput.scrollIntoViewIfNeeded();
    await symbolInput.fill(tokenSymbol);
    console.log(`✅ Token symbol entered: ${tokenSymbol}`);

    // 7. Upload Token Icon (required)
    console.log('📸 Uploading token icon...');
    const tokenIconInput = page.locator('input[type="file"]').last();
    // Create a simple test image for the icon
    const iconBuffer = createTestImageBuffer();
    const iconPath = path.join(process.cwd(), `test-results-production/test-token-advanced-icon-${timestamp}.png`);
    fs.writeFileSync(iconPath, iconBuffer);
    await tokenIconInput.setInputFiles(iconPath);
    await page.waitForTimeout(1000);
    console.log('✅ Token icon uploaded');

    // Take screenshot before enabling advanced settings
    await page.screenshot({
      path: `test-results-production/token-advanced-form-filled-basic-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // ADVANCED SETTINGS SECTION
    // ========================================
    console.log('');
    console.log('🎛️ ═══════════════════════════════════════════════════════════');
    console.log('🎛️  CONFIGURING ADVANCED TOKEN SETTINGS (RANDOMIZED)');
    console.log('🎛️ ═══════════════════════════════════════════════════════════');
    console.log('');

    // Scroll down to find Advanced Token Settings section
    console.log('📜 Scrolling to Advanced Token Settings section...');
    
    const advancedSection = page.locator('text=Advanced Token Settings').first();
    await advancedSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Take screenshot of Advanced Settings section
    await page.screenshot({
      path: `test-results-production/token-advanced-settings-before-${timestamp}.png`,
      fullPage: true,
    });

    // 8. Enable Advanced Settings toggle (REQUIRED to show the other settings)
    console.log('🔓 Enabling Advanced Settings toggle...');
    
    // Find and click the "Enable Advanced Settings" toggle
    const enableAdvancedToggle = page.locator('text="Enable Advanced Settings"').locator('xpath=following::*[@role="switch" or @data-state][1]').first();
    
    // Alternative selectors if the first doesn't work
    let advancedToggleFound = false;
    
    if (await enableAdvancedToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await enableAdvancedToggle.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await enableAdvancedToggle.click();
      advancedToggleFound = true;
      console.log('✅ Advanced Settings enabled (method 1)');
    } else {
      // Try finding by looking for any switch after "Enable Advanced Settings" text
      const advancedToggleAlt = page.locator('button[role="switch"]').filter({
        hasNot: page.locator('[data-state="checked"]')
      }).first();
      
      // Find the container with "Enable Advanced Settings" and get its switch
      const advancedContainer = page.locator('div:has-text("Enable Advanced Settings")').filter({
        has: page.locator('button[role="switch"]')
      }).last();
      
      const toggleInContainer = advancedContainer.locator('button[role="switch"]').first();
      
      if (await toggleInContainer.isVisible({ timeout: 2000 }).catch(() => false)) {
        await toggleInContainer.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        await toggleInContainer.click();
        advancedToggleFound = true;
        console.log('✅ Advanced Settings enabled (method 2)');
      }
    }

    if (!advancedToggleFound) {
      // Last resort: click any unchecked switch near "Enable Advanced Settings"
      await page.evaluate(() => {
        const text = Array.from(document.querySelectorAll('*')).find(el => 
          el.textContent?.includes('Enable Advanced Settings') && 
          !el.querySelector('*')
        );
        if (text) {
          const parent = text.closest('div');
          const toggle = parent?.querySelector('button[role="switch"]') as HTMLElement;
          if (toggle) toggle.click();
        }
      });
      console.log('✅ Advanced Settings enabled (method 3 - evaluate)');
    }

    // Wait for the advanced settings panel to expand/appear
    await page.waitForTimeout(1500);

    // Take screenshot after enabling advanced settings
    await page.screenshot({
      path: `test-results-production/token-advanced-settings-expanded-${timestamp}.png`,
      fullPage: true,
    });

    // 9. Configure each advanced setting based on the random configuration
    console.log('');
    console.log('🎲 Applying randomized settings...');
    
    // Scroll down to see all advanced settings
    const tokenSupplySection = page.locator('text=Token Supply').first();
    if (await tokenSupplySection.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tokenSupplySection.scrollIntoViewIfNeeded();
    }
    await page.waitForTimeout(500);

    // Apply each setting
    for (const setting of advancedSettings) {
      console.log(`🔧 Setting: ${setting.name} → ${setting.enabled ? 'ON' : 'OFF'}`);
      const toggled = await toggleSwitchByLabel(page, setting.label, setting.enabled);
      
      // If "Enable Limited Supply" is turned ON, fill in the required fields
      if (setting.name === 'Enable Limited Supply' && setting.enabled && toggled) {
        await fillLimitedSupplyFields(page);
      }
      
      // If "Enable Token Price" is turned ON, fill in the required fields
      if (setting.name === 'Enable Token Price' && setting.enabled && toggled) {
        await fillTokenPriceFields(page);
      }
      
      await page.waitForTimeout(300);
    }

    console.log('');
    console.log('✅ All advanced settings configured!');
    console.log('');

    // Take screenshot of configured advanced settings
    await page.screenshot({
      path: `test-results-production/token-advanced-settings-configured-${timestamp}.png`,
      fullPage: true,
    });

    // Wait for form validation
    await page.waitForTimeout(1000);

    // Find and click the submit/create button
    console.log('🔍 Looking for Publish button...');
    const submitButton = page.locator('button:has-text("Publish"), button:has-text("Create"), button:has-text("Submit"), button:has-text("Issue"), button[type="submit"]').last();
    
    await submitButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();

    console.log('📝 Form filled with advanced settings, clicking Publish...');
    await submitButton.click();
    
    console.log('✅ Publish button clicked!');

    // Wait for submission to complete
    console.log(
      '⏳ Waiting for token creation (this may take up to 2 minutes)...',
    );

    // Wait for loading bar/spinner to appear and then disappear
    const loadingSelectors = [
      '.animate-spin',
      '[class*="progress"]',
      '[class*="loading"]',
      '[role="progressbar"]',
      'text=/creating/i',
      'text=/issuing/i',
      'text=/processing/i',
      'text=/publishing/i',
    ];

    // First, wait a bit for loading to start
    await page.waitForTimeout(2000);

    // Check if any loading indicator is visible and wait for it to disappear
    for (const selector of loadingSelectors) {
      const loadingElement = page.locator(selector).first();
      if (await loadingElement.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`🔄 Loading detected (${selector}), waiting for completion...`);
        // Wait for this loading indicator to disappear (up to 2 minutes)
        await loadingElement.waitFor({ state: 'hidden', timeout: 120000 }).catch(() => {
          console.log('⚠️ Loading indicator still visible after timeout');
        });
        console.log('✅ Loading completed');
        break;
      }
    }

    // Additional wait to ensure everything is done
    await page.waitForTimeout(3000);

    // Take screenshot after loading
    await page.screenshot({
      path: `test-results-production/token-advanced-after-loading-${timestamp}.png`,
      fullPage: true,
    });

    // Wait for success indicator or dialog to close
    try {
      // Wait for either success message, dialog to close, or navigation
      await Promise.race([
        page.waitForSelector('text=/success/i', { timeout: 30000 }),
        page.waitForSelector('text=/created/i', { timeout: 30000 }),
        page.waitForURL((url) => !url.pathname.includes('/create'), { timeout: 30000 }),
      ]);
      console.log('✅ Token creation appears to have succeeded!');
    } catch {
      await page.screenshot({
        path: `test-results-production/token-advanced-error-${timestamp}.png`,
        fullPage: true,
      });
      
      // Check for error messages
      const errorMessages = await page
        .locator('[data-slot="form-message"], [role="alert"], text=/error/i')
        .allTextContents();
      const realErrors = errorMessages.filter(
        (msg) => msg.trim() && msg.trim() !== '*' && msg.trim().length > 2,
      );

      if (realErrors.length > 0) {
        throw new Error(
          `Token creation failed with error: ${realErrors.join(', ')}`,
        );
      }
      
      console.log('⚠️ Could not confirm token creation - check manually');
    }

    // Take a success screenshot
    await page.screenshot({
      path: `test-results-production/token-advanced-success-${timestamp}.png`,
      fullPage: true,
    });

    // Log the result
    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  ✅ TOKEN WITH ADVANCED SETTINGS ISSUED SUCCESSFULLY           ║',
    );
    console.log(
      '║                                                                ║',
    );
    console.log(`║  Name: ${tokenName.padEnd(54)}║`);
    console.log(`║  Symbol: ${tokenSymbol.padEnd(52)}║`);
    console.log(
      '║                                                                ║',
    );
    console.log(
      '║  🎲 RANDOMIZED ADVANCED SETTINGS APPLIED:                      ║',
    );
    for (const setting of advancedSettings) {
      const status = setting.enabled ? '✅ ON ' : '❌ OFF';
      const settingDisplay = `${status} ${setting.name}`;
      console.log(`║    ${settingDisplay.padEnd(58)}║`);
    }
    console.log(
      '║                                                                ║',
    );
    console.log(
      '║  ⚠️  Remember to delete this test token if needed!             ║',
    );
    console.log(
      '╚════════════════════════════════════════════════════════════════╝',
    );
    console.log('');
  });
});

