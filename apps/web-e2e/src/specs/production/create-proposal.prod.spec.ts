import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Production Test: Create a Collective Agreement
 *
 * ⚠️  WARNING: This test creates REAL data on production!
 * ⚠️  The agreement will appear on https://app.hypha.earth
 * ⚠️  Only run this intentionally!
 *
 * Prerequisites:
 *   1. Run auth setup first: npx nx e2e-production-auth web-e2e
 *
 * Run this test:
 *   npx nx e2e-production-create-proposal web-e2e -- --headed
 */

// Will select the first space from the user's spaces list

/**
 * Creates a test image buffer (a simple colored PNG)
 */
function createTestImageBuffer(): Buffer {
  // Minimal valid PNG - a 100x100 blue image
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
      // Blue color for agreement image
      rawData.push(50, 100, 200);
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

test.describe('Create Collective Agreement on Production', () => {
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

  test('should create a collective agreement with title and description', async ({
    page,
  }) => {
    // Generate unique agreement name with timestamp
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const agreementTitle = `E2E Test Agreement ${timestamp}${randomSuffix}`;
    const agreementDescription =
      'This collective agreement was created by automated E2E tests. It can be safely deleted or rejected.';

    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  🚀 CREATING COLLECTIVE AGREEMENT ON PRODUCTION                ║',
    );
    console.log(`║  Title: ${agreementTitle.substring(0, 52).padEnd(52)}║`);
    console.log(
      '╚════════════════════════════════════════════════════════════════╝',
    );
    console.log('');

    // Navigate to my-spaces to select the first space
    console.log('📍 Navigating to My Spaces...');
    await page.goto('/en/my-spaces');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click on the first space in the list
    console.log('🔘 Clicking on first space...');
    const firstSpace = page.locator('a[href*="/dho/"]').first();
    await expect(firstSpace).toBeVisible({ timeout: 10000 });
    
    // Get the space name for logging
    const spaceName = await firstSpace.textContent();
    console.log(`📍 Selected space: ${spaceName}`);
    
    await firstSpace.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Navigate to agreements tab
    console.log('📍 Navigating to agreements...');
    const agreementsTab = page.locator('a[href*="/agreements"]').first();
    if (await agreementsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await agreementsTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }

    // Click the Create button to open the create menu
    console.log('🔘 Clicking Create button...');
    const createButton = page.getByRole('button', { name: /create/i }).first();
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();
    await page.waitForTimeout(1000);

    // Select "Make a Collective Agreement" from the options
    console.log('📋 Selecting "Make a Collective Agreement"...');
    const agreementOption = page.locator('text=Make a Collective Agreement').first();
    await expect(agreementOption).toBeVisible({ timeout: 5000 });
    await agreementOption.click();
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('📝 Filling agreement form...');

    // Create test images for upload (lead image and attachment)
    const testImageBuffer = createTestImageBuffer();
    const leadImagePath = path.join(
      process.cwd(),
      `test-results-production/test-lead-image-${timestamp}.png`,
    );
    const attachmentPath = path.join(
      process.cwd(),
      `test-results-production/test-attachment-${timestamp}.png`,
    );

    // Ensure directory exists
    fs.mkdirSync(path.dirname(leadImagePath), { recursive: true });

    // Write test images to disk
    fs.writeFileSync(leadImagePath, testImageBuffer);
    fs.writeFileSync(attachmentPath, testImageBuffer);

    // Wait for form to be ready - look for the title input
    const titleInput = page.getByPlaceholder('Proposal title...');
    await titleInput.waitFor({ state: 'visible', timeout: 15000 });

    // Fill in the agreement title first
    console.log('📝 Filling title...');
    await titleInput.fill(agreementTitle);

    // Upload lead image
    console.log('📸 Uploading lead image...');
    const fileInputs = page.locator('input[type="file"]');
    const leadImageInput = fileInputs.first();
    
    if (await leadImageInput.count() > 0) {
      await leadImageInput.setInputFiles(leadImagePath);
      await page.waitForTimeout(1500); // Allow image to process

      // Check if the image resizer modal appeared and handle it
      const cropButton = page.getByRole('button', { name: /crop/i });
      if (await cropButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('📐 Cropping lead image...');
        await cropButton.click();
        await page.waitForTimeout(1000);
      }
    } else {
      console.log('⚠️ No file input found for lead image');
    }

    // Fill in the description (RichTextEditor - MDXEditor with contenteditable)
    console.log('📝 Filling description...');
    // MDXEditor uses a contenteditable div with class mdxeditor-root-contenteditable
    const descriptionEditor = page.locator('[contenteditable="true"]').first();
    await descriptionEditor.waitFor({ state: 'visible', timeout: 15000 });
    await descriptionEditor.click();
    await page.waitForTimeout(500);
    await page.keyboard.type(agreementDescription);

    // Upload attachment
    console.log('📎 Adding attachment...');
    const addAttachmentButton = page.getByRole('button', { name: /add attachment/i });
    if (await addAttachmentButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // The AddAttachment component has a hidden file input inside the button
      // We need to find the file input inside or near the button
      const attachmentInput = page.locator('input[type="file"]').last();
      await attachmentInput.setInputFiles(attachmentPath);
      await page.waitForTimeout(1000);
      console.log('✅ Attachment added');
    } else {
      console.log('⚠️ Add attachment button not found');
    }

    // Wait for any form validation
    await page.waitForTimeout(1000);

    // Take a screenshot before submitting
    await page.screenshot({
      path: `test-results-production/create-agreement-form-${timestamp}.png`,
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
          path: `test-results-production/create-agreement-form-errors-${timestamp}.png`,
          fullPage: true,
        });
        throw new Error(`Form has validation errors: ${errors.join(', ')}`);
      }
    }

    // Look for and click the submit/publish button
    console.log('🔍 Looking for Publish button...');
    
    // Take screenshot to see the form state
    await page.screenshot({
      path: `test-results-production/create-agreement-before-publish-${timestamp}.png`,
      fullPage: true,
    });

    // Find the Publish button using text
    const submitButton = page.locator('button:has-text("Publish")').last();
    
    await submitButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();

    console.log('📝 Form filled, clicking Publish...');

    // Click publish using multiple methods to ensure it works
    await submitButton.click();
    
    console.log('✅ Publish button clicked!');

    // Wait for submission to complete
    console.log(
      '⏳ Waiting for agreement creation (this may take up to 2 minutes)...',
    );

    // Look for loading indicators
    const loadingIndicators = [
      page.locator('text=/creating/i'),
      page.locator('text=/publishing/i'),
      page.locator('text=/uploading/i'),
      page.locator('[data-testid="loading-backdrop"]'),
      page.locator('.animate-spin'),
    ];

    let loadingDetected = false;
    for (const indicator of loadingIndicators) {
      if (await indicator.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('🔄 Agreement creation in progress...');
        loadingDetected = true;
        break;
      }
    }

    if (!loadingDetected) {
      // Take a screenshot to see what's on screen
      await page.screenshot({
        path: `test-results-production/create-agreement-no-loading-${timestamp}.png`,
        fullPage: true,
      });
      console.log(
        '⚠️ No loading indicator detected - form may have submitted immediately or failed',
      );
    }

    // Wait for navigation away from create page
    // This indicates the agreement was created successfully
    try {
      await page.waitForURL(
        (url) => !url.pathname.includes('/create'),
        { timeout: 120000 },
      );
      console.log('✅ Navigation from create page detected!');
    } catch {
      // Take screenshot if something went wrong
      await page.screenshot({
        path: `test-results-production/create-agreement-error-${timestamp}.png`,
        fullPage: true,
      });

      const currentUrl = page.url();
      if (currentUrl.includes('/create')) {
        // Check for error messages
        const errorMessages = await page
          .locator('[data-slot="form-message"], [role="alert"], text=/error/i')
          .allTextContents();
        const realErrors = errorMessages.filter(
          (msg) => msg.trim() && msg.trim() !== '*' && msg.trim().length > 2,
        );

        if (realErrors.length > 0) {
          throw new Error(
            `Agreement creation failed with error: ${realErrors.join(', ')}`,
          );
        }
        throw new Error(
          'Agreement creation did not complete - still on create page',
        );
      }
      throw new Error('Agreement creation did not complete in expected time');
    }

    console.log('✅ Agreement creation appears to have succeeded!');

    // Clean up test images
    try {
      fs.unlinkSync(leadImagePath);
      fs.unlinkSync(attachmentPath);
    } catch {
      // Ignore cleanup errors
    }

    // Get the actual URL we navigated to
    const createdAgreementUrl = page.url();
    console.log(`📍 Navigated to: ${createdAgreementUrl}`);

    // Take a success screenshot
    await page.screenshot({
      path: `test-results-production/create-agreement-success-${timestamp}.png`,
      fullPage: true,
    });

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're not on an error page
    const notFoundIndicator = page.locator('text=/not found|404|page.*error/i');
    if (await notFoundIndicator.isVisible().catch(() => false)) {
      throw new Error('Agreement page shows error or not found');
    }

    // Log the created agreement URL
    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  ✅ COLLECTIVE AGREEMENT CREATED SUCCESSFULLY                  ║',
    );
    console.log(
      '║                                                                ║',
    );
    console.log(`║  URL: ${createdAgreementUrl.substring(0, 54).padEnd(54)}║`);
    console.log(
      '║                                                                ║',
    );
    console.log(
      '║  ⚠️  Remember to reject/delete this test agreement when done!  ║',
    );
    console.log(
      '╚════════════════════════════════════════════════════════════════╝',
    );
    console.log('');

    // Final assertion - we should no longer be on the create page
    expect(createdAgreementUrl).not.toContain('/create');
  });
});

