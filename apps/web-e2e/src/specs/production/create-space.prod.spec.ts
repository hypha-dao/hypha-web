import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Production Test: Create a Real Space
 *
 * ⚠️  WARNING: This test creates REAL data on production!
 * ⚠️  The space will appear on https://app.hypha.earth
 * ⚠️  Only run this intentionally!
 *
 * Prerequisites:
 *   1. Run auth setup first: npx nx e2e-production-auth web-e2e
 *
 * Run this test:
 *   npx nx e2e-production-create-space web-e2e
 */

/**
 * Creates a test image buffer (a simple colored PNG)
 */
function createTestImageBuffer(): Buffer {
  // Minimal valid PNG - a 100x100 red image
  // This is a properly formatted PNG that will pass validation
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
      // Red color
      rawData.push(200, 50, 50);
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
  result.writeUInt32BE((b << 16) | a, 0);
  return result;
}

test.describe('Create Space on Production', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to my-spaces where we can create a space
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

  test('create a new space with unique name', async ({ page }) => {
    // Generate unique space name with timestamp + random suffix for extra uniqueness
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const spaceName = `E2E Test ${timestamp}${randomSuffix}`;
    const spaceDescription =
      'This space was created by automated E2E tests. It can be safely deleted.';

    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  🚀 CREATING REAL SPACE ON PRODUCTION                          ║',
    );
    console.log(`║  Name: ${spaceName.padEnd(52)}║`);
    console.log(
      '╚════════════════════════════════════════════════════════════════╝',
    );
    console.log('');

    // Click "Create Space" button - use first() since there may be multiple
    const createSpaceButton = page
      .getByRole('link', { name: /create space/i })
      .first();

    // Wait for the button to be visible and click it
    await expect(createSpaceButton).toBeVisible({ timeout: 10000 });
    await createSpaceButton.click();

    // Wait for create space form to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Allow form to fully render

    // Create test images for upload
    const testImageBuffer = createTestImageBuffer();
    const logoPath = path.join(
      process.cwd(),
      `test-results-production/test-logo-${timestamp}.png`,
    );
    const bannerPath = path.join(
      process.cwd(),
      `test-results-production/test-banner-${timestamp}.png`,
    );

    // Ensure directory exists
    fs.mkdirSync(path.dirname(logoPath), { recursive: true });

    // Write test images to disk
    fs.writeFileSync(logoPath, testImageBuffer);
    fs.writeFileSync(bannerPath, testImageBuffer);

    console.log('📸 Uploading space logo...');

    // Upload logo image (avatar) - it's the first file input in the form
    // The UploadAvatar component renders an input[type="file"] inside a dropzone
    const fileInputs = page.locator('input[type="file"]');
    const logoInput = fileInputs.first();
    await logoInput.setInputFiles(logoPath);
    await page.waitForTimeout(500); // Allow image to process

    console.log('📸 Uploading space banner...');

    // Upload banner/lead image - it's the second file input
    const bannerInput = fileInputs.nth(1);
    await bannerInput.setInputFiles(bannerPath);
    await page.waitForTimeout(500);

    // Check if the image resizer modal appeared and handle it
    const cropButton = page.getByRole('button', { name: /crop.*save/i });
    if (await cropButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('📐 Cropping banner image...');
      await cropButton.click();
      await page.waitForTimeout(500);
    }

    console.log('📝 Filling form fields...');

    // Fill in the space title - use specific placeholder
    const titleInput = page.getByPlaceholder(/name your space/i);
    await titleInput.waitFor({ state: 'visible', timeout: 10000 });
    await titleInput.fill(spaceName);

    // Wait for slug to auto-generate and validate
    await page.waitForTimeout(1500);

    // Check if slug already exists (real-time validation) and wait for it to clear
    // The form validates slugs in real-time, so we need to ensure the slug is available
    const slugErrorMessage = page.locator(
      'text=/a space with this name already exists/i',
    );
    if (await slugErrorMessage.isVisible().catch(() => false)) {
      console.log('⚠️ Slug already exists, adding extra randomness...');
      // Add more randomness to the title
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const uniqueSpaceName = `${spaceName} ${randomSuffix}`;
      await titleInput.clear();
      await titleInput.fill(uniqueSpaceName);
      await page.waitForTimeout(1500); // Wait for re-validation
      console.log(`📝 Updated space name to: ${uniqueSpaceName}`);
    }

    // Fill in the description (Purpose field)
    const descriptionInput = page.getByPlaceholder(
      /type your space purpose here/i,
    );
    await descriptionInput.waitFor({ state: 'visible', timeout: 5000 });
    await descriptionInput.fill(spaceDescription);

    // Wait for any final validation
    await page.waitForTimeout(500);

    // Take a screenshot before submitting
    await page.screenshot({
      path: `test-results-production/create-space-form-${timestamp}.png`,
      fullPage: true,
    });

    // Check for any visible form errors before submitting
    // Note: We look for actual error messages, not the '*' asterisks which are RequirementMark indicators
    const formErrors = page.locator('[data-slot="form-message"]');
    const errorCount = await formErrors.count();
    if (errorCount > 0) {
      const errors: string[] = [];
      for (let i = 0; i < errorCount; i++) {
        const text = await formErrors.nth(i).textContent();
        // Filter out empty strings and single asterisks (RequirementMark)
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
          path: `test-results-production/create-space-form-errors-${timestamp}.png`,
          fullPage: true,
        });
        throw new Error(`Form has validation errors: ${errors.join(', ')}`);
      }
    }

    // Look for and click the submit/create button
    const submitButton = page.getByRole('button', { name: /^create$/i });

    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();

    console.log('📝 Form filled, submitting...');

    // Click create
    await submitButton.click();

    // Wait for creation to complete
    // This might take a while as it involves blockchain transactions
    console.log(
      '⏳ Waiting for space creation (this may take up to 2 minutes)...',
    );

    // Wait for the loading backdrop to appear with progress messages
    // The orchestrator shows: "Creating Web2 space...", "Creating Web3 space...", etc.
    const loadingIndicators = [
      page.locator('text=/creating web2 space/i'),
      page.locator('text=/creating web3 space/i'),
      page.locator('text=/uploading/i'),
      page.locator('[data-testid="loading-backdrop"]'),
      page.locator('.animate-spin'), // spinner
    ];

    let loadingDetected = false;
    for (const indicator of loadingIndicators) {
      if (await indicator.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('🔄 Space creation in progress...');
        loadingDetected = true;
        break;
      }
    }

    if (!loadingDetected) {
      // Take a screenshot to see what's on screen
      await page.screenshot({
        path: `test-results-production/create-space-no-loading-${timestamp}.png`,
        fullPage: true,
      });
      console.log(
        '⚠️ No loading indicator detected - form may not have submitted properly',
      );

      // Check for any visible error messages (filter out '*' requirement marks)
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

    // Now wait for navigation to the new space (this happens when progress reaches 100%)
    // The URL pattern will be /en/dho/<slug>/overview
    try {
      await page.waitForURL(/\/dho\/[^/]+\/(overview|agreements)/, {
        timeout: 120000,
      });
      console.log('✅ Navigation to new space detected!');
    } catch {
      // Take screenshot if something went wrong
      await page.screenshot({
        path: `test-results-production/create-space-error-${timestamp}.png`,
        fullPage: true,
      });

      // Check if we're still on create page
      const currentUrl = page.url();
      if (currentUrl.includes('/create')) {
        // Check for error messages on the page (filter out '*' requirement marks)
        const errorMessages = await page
          .locator('[data-slot="form-message"], [role="alert"], text=/error/i')
          .allTextContents();
        const realErrors = errorMessages.filter(
          (msg) => msg.trim() && msg.trim() !== '*' && msg.trim().length > 2,
        );

        if (realErrors.length > 0) {
          throw new Error(
            `Space creation failed with error: ${realErrors.join(', ')}`,
          );
        }
        throw new Error(
          'Space creation did not complete - still on create page',
        );
      }
      throw new Error('Space creation did not complete in expected time');
    }

    console.log('✅ Space creation appears to have succeeded!');

    // Clean up test images
    try {
      fs.unlinkSync(logoPath);
      fs.unlinkSync(bannerPath);
    } catch {
      // Ignore cleanup errors
    }

    // Get the actual URL we navigated to (this contains the real slug)
    const createdSpaceUrl = page.url();
    console.log(`📍 Navigated to: ${createdSpaceUrl}`);

    // Take a success screenshot
    await page.screenshot({
      path: `test-results-production/create-space-success-${timestamp}.png`,
      fullPage: true,
    });

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check if space page loaded (might 404 if something went wrong)
    const pageTitle = await page.title();
    console.log(`📄 Final page title: ${pageTitle}`);

    // Verify we're not on an error page
    const notFoundIndicator = page.locator('text=/not found|404|page.*error/i');
    if (await notFoundIndicator.isVisible().catch(() => false)) {
      throw new Error('Space page shows error or not found');
    }

    // Verify URL is correct (we navigated to the new space)
    expect(createdSpaceUrl).toContain('/dho/');
    expect(createdSpaceUrl).toContain('/overview');

    // Log the created space URL
    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  ✅ SPACE CREATED SUCCESSFULLY                                 ║',
    );
    console.log(
      '║                                                                ║',
    );
    console.log(`║  URL: ${createdSpaceUrl.substring(0, 54).padEnd(54)}║`);
    console.log(
      '║                                                                ║',
    );
    console.log(
      '║  ⚠️  Remember to delete this test space when done!             ║',
    );
    console.log(
      '╚════════════════════════════════════════════════════════════════╝',
    );
    console.log('');

    // Final assertion - we should be on the new space page
    expect(createdSpaceUrl).toMatch(/\/dho\/[^/]+\/(overview|agreements)/);
  });

  test.skip('create space with specific configuration', async ({ page }) => {
    /**
     * This is a template for creating spaces with specific settings.
     * Uncomment and customize as needed.
     *
     * ⚠️  WARNING: Creates real data!
     */

    const spaceConfig = {
      name: `Configured Test Space ${Date.now()}`,
      description: 'A test space with specific configuration',
      // Add more config options as needed
    };

    // ... implementation would go here
  });
});
