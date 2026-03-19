import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Production Test: Pay Expenses for Products or Service
 *
 * ⚠️  WARNING: This test creates REAL data on production!
 * ⚠️  The expense proposal will appear on https://app.hypha.earth
 * ⚠️  Only run this intentionally!
 *
 * Prerequisites:
 *   1. Run auth setup first: npx nx e2e-production-auth web-e2e
 *
 * Run this test:
 *   npx nx e2e-production-create-expense web-e2e -- --headed
 */

/**
 * Creates a test image buffer (a simple colored PNG)
 */
function createTestImageBuffer(): Buffer {
  // Minimal valid PNG - a 100x100 orange image (different color for expense)
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
      // Orange color for expense image
      rawData.push(255, 150, 50);
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

test.describe('Pay Expenses on Production', () => {
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

  test('should create an expense proposal with title and description', async ({
    page,
  }) => {
    // Generate unique expense name with timestamp
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const expenseTitle = `E2E Test Expense ${timestamp}${randomSuffix}`;
    const expenseDescription =
      'This expense was created by automated E2E tests. It can be safely deleted or rejected.';

    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  🚀 CREATING EXPENSE PROPOSAL ON PRODUCTION                    ║',
    );
    console.log(`║  Title: ${expenseTitle.substring(0, 52).padEnd(52)}║`);
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
    console.log('🔘 Looking for "qa testing" space...');
    const qaTestingSpace = page.locator('a[href*="/dho/"]', { hasText: /qa testing/i });
    await expect(qaTestingSpace).toBeVisible({ timeout: 10000 });
    
    // Get the space name for logging
    const spaceName = await qaTestingSpace.textContent();
    console.log(`📍 Selected space: ${spaceName}`);
    
    await qaTestingSpace.click();
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

    // Select "Pay expenses for products or service" from the options
    console.log('📋 Selecting "Pay expenses for products or service"...');
    const expenseOption = page.locator('text=Pay expenses for products or service').first();
    await expect(expenseOption).toBeVisible({ timeout: 5000 });
    await expenseOption.click();
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('📝 Filling expense form...');

    // Create test images for upload (lead image and attachment)
    const testImageBuffer = createTestImageBuffer();
    const leadImagePath = path.join(
      process.cwd(),
      `test-results-production/test-expense-lead-image-${timestamp}.png`,
    );
    const attachmentPath = path.join(
      process.cwd(),
      `test-results-production/test-expense-attachment-${timestamp}.png`,
    );

    // Ensure directory exists
    fs.mkdirSync(path.dirname(leadImagePath), { recursive: true });

    // Write test images to disk
    fs.writeFileSync(leadImagePath, testImageBuffer);
    fs.writeFileSync(attachmentPath, testImageBuffer);

    // Wait for form to be ready - look for the title input
    const titleInput = page.getByPlaceholder('Proposal title...');
    await titleInput.waitFor({ state: 'visible', timeout: 15000 });

    // Fill in the expense title first
    console.log('📝 Filling title...');
    await titleInput.fill(expenseTitle);

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
    const descriptionEditor = page.locator('[contenteditable="true"]').first();
    await descriptionEditor.waitFor({ state: 'visible', timeout: 15000 });
    await descriptionEditor.click();
    await page.waitForTimeout(500);
    await page.keyboard.type(expenseDescription);

    // Upload attachment - scroll to it first
    console.log('📎 Adding attachment...');
    const addAttachmentButton = page.locator('text=Add Attachment').first();
    await addAttachmentButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    if (await addAttachmentButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      const attachmentInput = page.locator('input[type="file"]').last();
      await attachmentInput.setInputFiles(attachmentPath);
      await page.waitForTimeout(1000);
      console.log('✅ Attachment added');
    } else {
      console.log('⚠️ Add attachment button not found');
    }

    // Select recipient member - first click "Member" tab, then select from dropdown
    console.log('👤 Selecting recipient member...');
    
    // Scroll to Recipient section first
    const recipientLabel = page.locator('text=Recipient').first();
    await recipientLabel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    // Click on "Member" tab first (as "Space" is selected by default)
    // Find the Member tab that's near the Space tab in the Recipient row
    console.log('🔘 Clicking Member tab...');
    // Look for Member text that's NOT in "Already member" - it should be a sibling of Space
    const memberTab = page.locator('button:text-is("Member")').first();
    await memberTab.click();
    await page.waitForTimeout(500);
    console.log('✅ Clicked Member tab');
    
    // Now select member from dropdown
    const memberSelect = page.locator('text=Select member...').first();
    await page.waitForTimeout(500);
    if (await memberSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await memberSelect.click();
      await page.waitForTimeout(1000);
      
      // Wait for dropdown to open, then click on "Martin test" option
      const martinOption = page.locator('[role="option"]:has-text("Martin test"), [data-radix-collection-item]:has-text("Martin test"), li:has-text("Martin test"), div[class*="option"]:has-text("Martin test")').first();
      await martinOption.waitFor({ state: 'visible', timeout: 5000 });
      await martinOption.click();
      await page.waitForTimeout(1000);
      console.log('✅ Recipient selected: Martin test');
    } else {
      console.log('⚠️ Member select not found');
    }

    // Take screenshot after member selection
    await page.screenshot({
      path: `test-results-production/debug-expense-after-member-${Date.now()}.png`,
      fullPage: true,
    });

    // Fill payment request amount
    console.log('💰 Filling payment request...');
    const amountInput = page.locator('input[placeholder="Amount"]').first();
    await amountInput.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    if (await amountInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await amountInput.click();
      await page.waitForTimeout(300);
      await amountInput.fill('1');
      console.log('✅ Amount entered: 1');
    } else {
      console.log('⚠️ Amount input not found');
    }

    // Select token
    console.log('🪙 Selecting token...');
    const tokenSelect = page.locator('text=Select a token').first();
    await tokenSelect.scrollIntoViewIfNeeded();
    if (await tokenSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await tokenSelect.click();
      await page.waitForTimeout(1000);
      const qatestOption = page.locator('text=QATEST').first();
      if (await qatestOption.isVisible({ timeout: 5000 }).catch(() => false)) {
        await qatestOption.click();
        await page.waitForTimeout(500);
        console.log('✅ Token selected: QATEST');
      } else {
        console.log('⚠️ QATEST option not found');
      }
    } else {
      console.log('⚠️ Token select not found');
    }

    // Wait for any form validation
    await page.waitForTimeout(1000);

    // Take a screenshot before submitting
    await page.screenshot({
      path: `test-results-production/create-expense-form-${timestamp}.png`,
      fullPage: true,
    });

    // Look for and click the submit/publish button
    console.log('🔍 Looking for Publish button...');
    
    await page.screenshot({
      path: `test-results-production/create-expense-before-publish-${timestamp}.png`,
      fullPage: true,
    });

    const submitButton = page.locator('button:has-text("Publish")').last();
    
    await submitButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();

    console.log('📝 Form filled, clicking Publish...');
    await submitButton.click();
    
    console.log('✅ Publish button clicked!');

    // Wait for submission to complete
    console.log(
      '⏳ Waiting for expense creation (this may take up to 2 minutes)...',
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
        console.log('🔄 Expense creation in progress...');
        loadingDetected = true;
        break;
      }
    }

    if (!loadingDetected) {
      await page.screenshot({
        path: `test-results-production/create-expense-no-loading-${timestamp}.png`,
        fullPage: true,
      });
      console.log(
        '⚠️ No loading indicator detected - form may have submitted immediately or failed',
      );
    }

    // Wait for navigation away from create page
    try {
      await page.waitForURL(
        (url) => !url.pathname.includes('/create'),
        { timeout: 120000 },
      );
      console.log('✅ Navigation from create page detected!');
    } catch {
      await page.screenshot({
        path: `test-results-production/create-expense-error-${timestamp}.png`,
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
            `Expense creation failed with error: ${realErrors.join(', ')}`,
          );
        }
        throw new Error(
          'Expense creation did not complete - still on create page',
        );
      }
      throw new Error('Expense creation did not complete in expected time');
    }

    console.log('✅ Expense creation appears to have succeeded!');

    // Clean up test images
    try {
      fs.unlinkSync(leadImagePath);
      fs.unlinkSync(attachmentPath);
    } catch {
      // Ignore cleanup errors
    }

    // Get the actual URL we navigated to
    const createdExpenseUrl = page.url();
    console.log(`📍 Navigated to: ${createdExpenseUrl}`);

    // Take a success screenshot
    await page.screenshot({
      path: `test-results-production/create-expense-success-${timestamp}.png`,
      fullPage: true,
    });

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're not on an error page
    const notFoundIndicator = page.locator('text=/not found|404|page.*error/i');
    if (await notFoundIndicator.isVisible().catch(() => false)) {
      throw new Error('Expense page shows error or not found');
    }

    // Log the created expense URL
    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  ✅ EXPENSE PROPOSAL CREATED SUCCESSFULLY                      ║',
    );
    console.log(
      '║                                                                ║',
    );
    console.log(`║  URL: ${createdExpenseUrl.substring(0, 54).padEnd(54)}║`);
    console.log(
      '║                                                                ║',
    );
    console.log(
      '║  ⚠️  Remember to reject/delete this test expense!              ║',
    );
    console.log(
      '╚════════════════════════════════════════════════════════════════╝',
    );
    console.log('');

    // Final assertion - we should no longer be on the create page
    expect(createdExpenseUrl).not.toContain('/create');
  });
});

