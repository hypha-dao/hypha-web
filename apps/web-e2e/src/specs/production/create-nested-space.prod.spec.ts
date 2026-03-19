import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Production Test: Create a Nested Space (Space within a Space)
 *
 * ⚠️  WARNING: This test creates REAL data on production!
 * ⚠️  The nested space will appear on https://app.hypha.earth
 * ⚠️  Only run this intentionally!
 *
 * Prerequisites:
 *   1. Run auth setup first: npx nx e2e-production-auth web-e2e
 *
 * Run this test:
 *   npx nx e2e-production-create-nested-space web-e2e -- --headed
 */

/**
 * Creates a test image buffer (a simple colored PNG)
 */
function createTestImageBuffer(): Buffer {
  // Minimal valid PNG - a 100x100 purple image (different color for nested space)
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  // IHDR chunk (image header)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(100, 0); // width
  ihdrData.writeUInt32BE(100, 4); // height
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(2, 9); // color type (RGB)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
  const ihdrChunk = Buffer.concat([
    Buffer.from([0, 0, 0, 13]), // length
    Buffer.from('IHDR'),
    ihdrData,
    ihdrCrc,
  ]);

  // IDAT chunk (image data) - simplified
  const rawData: number[] = [];
  for (let y = 0; y < 100; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < 100; x++) {
      // Purple color for nested space image
      rawData.push(150, 50, 200);
    }
  }

  // Use zlib-like compression (store mode for simplicity)
  const deflated = deflateStore(Buffer.from(rawData));
  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), deflated]));
  const idatLen = Buffer.alloc(4);
  idatLen.writeUInt32BE(deflated.length, 0);
  const idatChunk = Buffer.concat([
    idatLen,
    Buffer.from('IDAT'),
    deflated,
    idatCrc,
  ]);

  // IEND chunk
  const iendCrc = crc32(Buffer.from('IEND'));
  const iendChunk = Buffer.concat([
    Buffer.from([0, 0, 0, 0]),
    Buffer.from('IEND'),
    iendCrc,
  ]);

  return Buffer.concat([pngHeader, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 implementation for PNG chunks
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

// Simple deflate store (no compression) for PNG
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

  // Add zlib header and adler32 checksum
  const zlibHeader = Buffer.from([0x78, 0x01]); // zlib header (no compression)
  const adler = adler32(data);

  return Buffer.concat([zlibHeader, ...blocks, adler]);
}

function adler32(data: Buffer): Buffer {
  let a = 1,
    b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]!) % 65521;
    b = (b + a) % 65521;
  }
  const result = Buffer.alloc(4);
  result.writeUInt32BE(((b << 16) | a) >>> 0, 0);
  return result;
}

test.describe('Create Nested Space on Production', () => {
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

  test('should create a nested space within QA TESTING space', async ({
    page,
  }) => {
    // Generate unique nested space name with timestamp
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const nestedSpaceName = `E2E Nested ${timestamp}${randomSuffix}`;
    const nestedSpaceDescription =
      'This nested space was created by automated E2E tests. It can be safely deleted.';

    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  🚀 CREATING NESTED SPACE ON PRODUCTION                        ║',
    );
    console.log(`║  Name: ${nestedSpaceName.substring(0, 52).padEnd(52)}║`);
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
    
    const parentSpaceName = await qaTestingSpace.textContent();
    console.log(`📍 Selected parent space: ${parentSpaceName}`);
    
    await qaTestingSpace.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click on Space Settings
    console.log('⚙️ Opening Space Settings...');
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
      path: `test-results-production/nested-space-settings-panel-${timestamp}.png`,
      fullPage: true,
    });

    // Click on "Add Space" - it's the second option in the settings menu
    console.log('🔍 Looking for "Add Space" option...');
    
    // Try to find "Add Space" option - it should be visible without scrolling as it's the second option
    const addSpaceOption = page.locator('text=Add Space').first();
    
    // If not visible, try scrolling within the settings panel
    if (!(await addSpaceOption.isVisible({ timeout: 2000 }).catch(() => false))) {
      console.log('📜 Scrolling to find "Add Space"...');
      const scrollableContainers = page.locator('[data-radix-scroll-area-viewport], [class*="overflow-auto"], [class*="overflow-y"]');
      const count = await scrollableContainers.count();
      for (let j = 0; j < count; j++) {
        await scrollableContainers.nth(j).evaluate((el) => {
          el.scrollTop = 0; // Scroll to top first
        }).catch(() => {});
      }
      await page.waitForTimeout(500);
    }

    await expect(addSpaceOption).toBeVisible({ timeout: 10000 });
    console.log('🔘 Clicking "Add Space"...');
    await addSpaceOption.click({ force: true });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ Add Space clicked');

    // Take screenshot after clicking Add Space
    await page.screenshot({
      path: `test-results-production/nested-space-add-space-form-${timestamp}.png`,
      fullPage: true,
    });

    // Now we should be in the create space form
    console.log('📝 Filling nested space form...');

    // Create test images for upload
    const testImageBuffer = createTestImageBuffer();
    const logoPath = path.join(
      process.cwd(),
      `test-results-production/test-nested-logo-${timestamp}.png`,
    );
    const bannerPath = path.join(
      process.cwd(),
      `test-results-production/test-nested-banner-${timestamp}.png`,
    );

    // Ensure directory exists
    fs.mkdirSync(path.dirname(logoPath), { recursive: true });

    // Write test images to disk
    fs.writeFileSync(logoPath, testImageBuffer);
    fs.writeFileSync(bannerPath, testImageBuffer);

    console.log('📸 Uploading space logo...');

    // Upload logo image (avatar) - it's the first file input in the form
    const fileInputs = page.locator('input[type="file"]');
    const logoInput = fileInputs.first();
    
    if (await logoInput.count() > 0) {
      await logoInput.setInputFiles(logoPath);
      await page.waitForTimeout(500); // Allow image to process
    }

    console.log('📸 Uploading space banner...');

    // Upload banner/lead image - it's the second file input
    const bannerInput = fileInputs.nth(1);
    if (await bannerInput.count() > 0) {
      await bannerInput.setInputFiles(bannerPath);
      await page.waitForTimeout(500);
    }

    // Check if the image resizer modal appeared and handle it
    const cropButton = page.getByRole('button', { name: /crop/i });
    if (await cropButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('📐 Cropping banner image...');
      await cropButton.click();
      await page.waitForTimeout(500);
    }

    console.log('📝 Filling form fields...');

    // Fill in the space title - use specific placeholder
    const titleInput = page.getByPlaceholder(/name your space/i);
    await titleInput.waitFor({ state: 'visible', timeout: 10000 });
    await titleInput.fill(nestedSpaceName);

    // Wait for slug to auto-generate and validate
    await page.waitForTimeout(1500);

    // Check if slug already exists (real-time validation) and wait for it to clear
    const slugErrorMessage = page.locator(
      'text=/a space with this name already exists/i',
    );
    if (await slugErrorMessage.isVisible().catch(() => false)) {
      console.log('⚠️ Slug already exists, adding extra randomness...');
      const randomSuffix2 = Math.random().toString(36).substring(2, 8);
      const uniqueSpaceName = `${nestedSpaceName} ${randomSuffix2}`;
      await titleInput.clear();
      await titleInput.fill(uniqueSpaceName);
      await page.waitForTimeout(1500);
      console.log(`📝 Updated space name to: ${uniqueSpaceName}`);
    }

    // Fill in the description (Purpose field)
    const descriptionInput = page.getByPlaceholder(
      /type your space purpose here/i,
    );
    await descriptionInput.waitFor({ state: 'visible', timeout: 5000 });
    await descriptionInput.fill(nestedSpaceDescription);

    // Select a random tag
    console.log('🏷️ Selecting a random tag...');
    const tagSelector = page.locator('text=Select a tag, text=Select tag, button:has-text("tag"), [placeholder*="tag"]').first();
    
    // Try to find the tag dropdown - it might be labeled differently
    const tagDropdown = page.locator('button:has-text("Select"), [role="combobox"]').filter({ hasText: /tag/i }).first();
    
    if (await tagDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tagDropdown.click();
      await page.waitForTimeout(500);
      
      // Get all available tag options
      const tagOptions = page.locator('[role="option"]');
      const tagCount = await tagOptions.count();
      
      if (tagCount > 0) {
        // Select a random tag
        const randomIndex = Math.floor(Math.random() * tagCount);
        const selectedTag = tagOptions.nth(randomIndex);
        const tagName = await selectedTag.textContent();
        await selectedTag.click();
        await page.waitForTimeout(500);
        console.log(`✅ Random tag selected: ${tagName}`);
      } else {
        console.log('⚠️ No tag options found');
      }
    } else {
      // Try alternative selector for tags
      const altTagSelector = page.locator('label:has-text("Tag") + div button, label:has-text("Tags") + div button').first();
      if (await altTagSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
        await altTagSelector.click();
        await page.waitForTimeout(500);
        
        const tagOptions = page.locator('[role="option"]');
        const tagCount = await tagOptions.count();
        
        if (tagCount > 0) {
          const randomIndex = Math.floor(Math.random() * tagCount);
          const selectedTag = tagOptions.nth(randomIndex);
          const tagName = await selectedTag.textContent();
          await selectedTag.click();
          await page.waitForTimeout(500);
          console.log(`✅ Random tag selected: ${tagName}`);
        }
      } else {
        console.log('⚠️ Tag selector not found - skipping tag selection');
      }
    }

    // Wait for any final validation
    await page.waitForTimeout(500);

    // Take a screenshot before submitting
    await page.screenshot({
      path: `test-results-production/create-nested-space-form-${timestamp}.png`,
      fullPage: true,
    });

    // Check for any visible form errors before submitting
    const formErrors = page.locator('[data-slot="form-message"]');
    const errorCount = await formErrors.count();
    if (errorCount > 0) {
      const errors: string[] = [];
      for (let i = 0; i < errorCount; i++) {
        const text = await formErrors.nth(i).textContent();
        if (
          text &&
          text.trim() &&
          text.trim() !== '*' &&
          text.trim().length > 2
        ) {
          errors.push(text.trim());
        }
      }
      if (errors.length > 0) {
        await page.screenshot({
          path: `test-results-production/create-nested-space-form-errors-${timestamp}.png`,
          fullPage: true,
        });
        throw new Error(`Form has validation errors: ${errors.join(', ')}`);
      }
    }

    // Look for and click the submit/create button - specifically the one inside the form
    const submitButton = page.locator('form').getByRole('button', { name: 'Create' });

    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();

    console.log('📝 Form filled, submitting...');

    // Click create
    await submitButton.click();

    // Wait for creation to complete
    console.log(
      '⏳ Waiting for nested space creation (this may take up to 2 minutes)...',
    );

    // Wait for loading indicators
    const loadingIndicators = [
      page.locator('text=/creating web2 space/i'),
      page.locator('text=/creating web3 space/i'),
      page.locator('text=/uploading/i'),
      page.locator('[data-testid="loading-backdrop"]'),
      page.locator('.animate-spin'),
    ];

    let loadingDetected = false;
    for (const indicator of loadingIndicators) {
      if (await indicator.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('🔄 Nested space creation in progress...');
        loadingDetected = true;
        break;
      }
    }

    if (!loadingDetected) {
      await page.screenshot({
        path: `test-results-production/create-nested-space-no-loading-${timestamp}.png`,
        fullPage: true,
      });
      console.log(
        '⚠️ No loading indicator detected - form may not have submitted properly',
      );

      const errorMessages = await page
        .locator('[data-slot="form-message"], [role="alert"]')
        .allTextContents();
      const realErrors = errorMessages.filter(
        (msg) => msg.trim() && msg.trim() !== '*' && msg.trim().length > 2,
      );
      if (realErrors.length > 0) {
        throw new Error(`Form errors detected: ${realErrors.join(', ')}`);
      }
    }

    // Wait for loading to complete
    const loadingSelectors = [
      '.animate-spin',
      '[class*="progress"]',
      '[class*="loading"]',
      '[role="progressbar"]',
    ];

    await page.waitForTimeout(2000);

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

    // Wait for navigation to the new nested space
    try {
      await page.waitForURL(/\/dho\/[^/]+\/(overview|agreements)/, {
        timeout: 120000,
      });
      console.log('✅ Navigation to new nested space detected!');
    } catch {
      await page.screenshot({
        path: `test-results-production/create-nested-space-error-${timestamp}.png`,
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
            `Nested space creation failed with error: ${realErrors.join(', ')}`,
          );
        }
        throw new Error(
          'Nested space creation did not complete - still on create page',
        );
      }
      throw new Error('Nested space creation did not complete in expected time');
    }

    console.log('✅ Nested space creation appears to have succeeded!');

    // Clean up test images
    try {
      fs.unlinkSync(logoPath);
      fs.unlinkSync(bannerPath);
    } catch {
      // Ignore cleanup errors
    }

    // Get the actual URL we navigated to
    const createdNestedSpaceUrl = page.url();
    console.log(`📍 Navigated to: ${createdNestedSpaceUrl}`);

    // Take a success screenshot
    await page.screenshot({
      path: `test-results-production/create-nested-space-success-${timestamp}.png`,
      fullPage: true,
    });

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're not on an error page
    const notFoundIndicator = page.locator('text=/not found|404|page.*error/i');
    if (await notFoundIndicator.isVisible().catch(() => false)) {
      throw new Error('Nested space page shows error or not found');
    }

    // Verify URL is correct
    expect(createdNestedSpaceUrl).toContain('/dho/');

    // Log the created nested space URL
    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  ✅ NESTED SPACE CREATED SUCCESSFULLY                          ║',
    );
    console.log(
      '║                                                                ║',
    );
    console.log(`║  URL: ${createdNestedSpaceUrl.substring(0, 54).padEnd(54)}║`);
    console.log(
      '║                                                                ║',
    );
    console.log(
      '║  ⚠️  Remember to delete this test nested space when done!      ║',
    );
    console.log(
      '╚════════════════════════════════════════════════════════════════╝',
    );
    console.log('');

    // Final assertion
    expect(createdNestedSpaceUrl).toMatch(/\/dho\/[^/]+/);
  });
});

