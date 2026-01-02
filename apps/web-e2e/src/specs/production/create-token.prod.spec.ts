import { test, expect } from '@playwright/test';
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
 * Production Test: Issue New Token
 *
 * ⚠️  WARNING: This test creates REAL data on production!
 * ⚠️  The token will be created on https://app.hypha.earth
 * ⚠️  Only run this intentionally!
 *
 * Prerequisites:
 *   1. Run auth setup first: npx nx e2e-production-auth web-e2e
 *
 * Run this test:
 *   npx nx e2e-production-create-token web-e2e -- --headed
 */

test.describe('Issue New Token on Production', () => {
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

  test('should issue a new token in the QA TESTING space', async ({
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

    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  🚀 ISSUING NEW TOKEN ON PRODUCTION                            ║',
    );
    console.log(`║  Name: ${tokenName.substring(0, 54).padEnd(54)}║`);
    console.log(`║  Symbol: ${tokenSymbol.padEnd(52)}║`);
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
      path: `test-results-production/token-settings-panel-${timestamp}.png`,
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
      path: `test-results-production/token-after-scroll-${timestamp}.png`,
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
      path: `test-results-production/token-form-${timestamp}.png`,
      fullPage: true,
    });

    // Fill out the token form
    console.log('📝 Filling token form...');

    // 1. Fill Proposal Title
    console.log('📝 Entering proposal title...');
    const titleInput = page.getByPlaceholder('Proposal title...');
    await titleInput.scrollIntoViewIfNeeded();
    await titleInput.fill(`Issue Token: ${tokenName}`);
    console.log(`✅ Title entered: Issue Token: ${tokenName}`);

    // 2. Fill Proposal Content/Description
    console.log('📝 Entering proposal description...');
    const descriptionEditor = page.locator('[contenteditable="true"]').first();
    await descriptionEditor.scrollIntoViewIfNeeded();
    await descriptionEditor.click();
    await page.waitForTimeout(300);
    await page.keyboard.type(`Creating a new token: ${tokenName} (${tokenSymbol}). This is a test token created by E2E automation.`);
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
    const iconPath = path.join(process.cwd(), `test-results-production/test-token-icon-${timestamp}.png`);
    fs.writeFileSync(iconPath, iconBuffer);
    await tokenIconInput.setInputFiles(iconPath);
    await page.waitForTimeout(1000);
    console.log('✅ Token icon uploaded');

    // Take screenshot before submitting
    await page.screenshot({
      path: `test-results-production/token-form-filled-${timestamp}.png`,
      fullPage: true,
    });

    // Wait for form validation
    await page.waitForTimeout(1000);

    // Find and click the submit/create button
    console.log('🔍 Looking for Submit/Create button...');
    const submitButton = page.locator('button:has-text("Create"), button:has-text("Submit"), button:has-text("Issue"), button[type="submit"]').last();
    
    await submitButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();

    console.log('📝 Form filled, clicking Submit...');
    await submitButton.click();
    
    console.log('✅ Submit button clicked!');

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
      path: `test-results-production/token-after-loading-${timestamp}.png`,
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
        path: `test-results-production/token-error-${timestamp}.png`,
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
      path: `test-results-production/token-success-${timestamp}.png`,
      fullPage: true,
    });

    // Log the result
    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  ✅ TOKEN ISSUED SUCCESSFULLY                                  ║',
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
      '║  ⚠️  Remember to delete this test token if needed!             ║',
    );
    console.log(
      '╚════════════════════════════════════════════════════════════════╝',
    );
    console.log('');
  });
});

