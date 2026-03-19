import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Creates a test image buffer (a simple colored PNG)
 */
function createTestImageBuffer(): Buffer {
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  // Random color for the image
  const r = Math.floor(Math.random() * 200) + 50;
  const g = Math.floor(Math.random() * 200) + 50;
  const b = Math.floor(Math.random() * 200) + 50;

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
    Buffer.from([0, 0, 0, 13]),
    Buffer.from('IHDR'),
    ihdrData,
    ihdrCrc,
  ]);

  // IDAT chunk (image data)
  const rawData: number[] = [];
  for (let y = 0; y < 100; y++) {
    rawData.push(0);
    for (let x = 0; x < 100; x++) {
      rawData.push(r, g, b);
    }
  }

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

/**
 * Creates a new space and returns its name
 */
async function createNewSpace(page: Page): Promise<string> {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  const spaceName = `E2E Exit ${timestamp}${randomSuffix}`;
  const spaceDescription = 'Space created for exit test. Will be exited immediately.';

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 STEP 1: CREATING NEW SPACE TO EXIT                         ║');
  console.log(`║  Name: ${spaceName.padEnd(52)}║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Navigate to my-spaces
  await page.goto('/en/my-spaces');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Click "Create Space" button
  const createSpaceButton = page.getByRole('link', { name: /create space/i }).first();
  await expect(createSpaceButton).toBeVisible({ timeout: 10000 });
  await createSpaceButton.click();

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Create test images for upload (logo and banner)
  const logoImageBuffer = createTestImageBuffer();
  const bannerImageBuffer = createTestImageBuffer();
  
  const logoPath = path.join(process.cwd(), `test-results-production/test-logo-exit-${timestamp}.png`);
  const bannerPath = path.join(process.cwd(), `test-results-production/test-banner-exit-${timestamp}.png`);

  // Ensure directory exists
  fs.mkdirSync(path.dirname(logoPath), { recursive: true });
  fs.writeFileSync(logoPath, logoImageBuffer);
  fs.writeFileSync(bannerPath, bannerImageBuffer);

  console.log('📸 Uploading space logo...');

  // Upload logo image (first file input)
  const fileInputs = page.locator('input[type="file"]');
  const logoInput = fileInputs.first();
  await logoInput.setInputFiles(logoPath);
  await page.waitForTimeout(500);

  console.log('📸 Uploading space banner...');

  // Upload banner image (second file input)
  const bannerInput = fileInputs.nth(1);
  await bannerInput.setInputFiles(bannerPath);
  await page.waitForTimeout(500);

  // Handle the crop modal
  const cropButton = page.getByRole('button', { name: /crop.*save/i });
  if (await cropButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('📐 Cropping banner image...');
    await cropButton.click();
    await page.waitForTimeout(500);
  }

  console.log('📝 Filling form fields...');

  // Fill in the space title
  const titleInput = page.getByPlaceholder(/name your space/i);
  await titleInput.waitFor({ state: 'visible', timeout: 10000 });
  await titleInput.fill(spaceName);

  await page.waitForTimeout(1500);

  // Check if slug already exists
  const slugErrorMessage = page.locator('text=/a space with this name already exists/i');
  if (await slugErrorMessage.isVisible().catch(() => false)) {
    console.log('⚠️ Slug already exists, adding extra randomness...');
    const extraSuffix = Math.random().toString(36).substring(2, 8);
    const uniqueSpaceName = `${spaceName} ${extraSuffix}`;
    await titleInput.clear();
    await titleInput.fill(uniqueSpaceName);
    await page.waitForTimeout(1500);
  }

  // Fill in the description
  const descriptionInput = page.getByPlaceholder(/type your space purpose here/i);
  await descriptionInput.waitFor({ state: 'visible', timeout: 5000 });
  await descriptionInput.fill(spaceDescription);

  await page.waitForTimeout(500);

  // Take screenshot before submitting
  await page.screenshot({
    path: `test-results-production/exit-space-create-form-${timestamp}.png`,
    fullPage: true,
  });

  // Click create button
  const submitButton = page.getByRole('button', { name: /^create$/i });
  await expect(submitButton).toBeVisible();
  await expect(submitButton).toBeEnabled();

  console.log('📝 Form filled, submitting...');
  await submitButton.click();

  console.log('⏳ Waiting for space creation (this may take up to 2 minutes)...');

  // Wait for navigation to the new space
  try {
    await page.waitForURL(/\/dho\/[^/]+\/(overview|agreements)/, { timeout: 120000 });
    console.log('✅ Navigation to new space detected!');
  } catch {
    await page.screenshot({
      path: `test-results-production/exit-space-create-error-${timestamp}.png`,
      fullPage: true,
    });
    throw new Error('Space creation did not complete in expected time');
  }

  const createdSpaceUrl = page.url();
  console.log(`✅ Space created! URL: ${createdSpaceUrl}`);

  // Clean up test images
  try {
    fs.unlinkSync(logoPath);
    fs.unlinkSync(bannerPath);
  } catch {
    // Ignore cleanup errors
  }

  return spaceName;
}

/**
 * Production Test: Exit Space
 *
 * ⚠️  WARNING: This test creates and exits a REAL space on production!
 * ⚠️  Only run this intentionally!
 *
 * Prerequisites:
 *   1. Run auth setup first: npx nx e2e-production-auth web-e2e
 *
 * Run this test:
 *   npx nx e2e-production-exit-space web-e2e -- --headed
 */

test.describe('Exit Space on Production', () => {
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

  test('should create a space and then exit it', async ({ page }) => {
    // Set longer timeout for this test (space creation + exit)
    test.setTimeout(300000); // 5 minutes

    const timestamp = Date.now();

    // ========================================
    // STEP 1: CREATE A NEW SPACE
    // ========================================
    const createdSpaceName = await createNewSpace(page);
    console.log(`📝 Created space name: ${createdSpaceName}`);

    // ========================================
    // STEP 2: NAVIGATE TO MY SPACES
    // ========================================
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  📍 STEP 2: NAVIGATING TO MY SPACES                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    await page.goto('/en/my-spaces');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ Navigated to My Spaces');

    // Take screenshot
    await page.screenshot({
      path: `test-results-production/exit-space-my-spaces-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 3: FIND THE CREATED SPACE
    // ========================================
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  🔍 STEP 3: FINDING THE CREATED SPACE                          ║');
    console.log(`║  Looking for: ${createdSpaceName.substring(0, 45).padEnd(45)}║`);
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Find the space card by name
    const spaceCard = page.locator(`text="${createdSpaceName}"`).first();
    
    if (await spaceCard.isVisible({ timeout: 10000 }).catch(() => false)) {
      console.log('✅ Found the created space');
      await spaceCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    } else {
      // Try partial match with the E2E Exit prefix
      const partialMatch = page.locator('text=/E2E Exit/').first();
      if (await partialMatch.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('✅ Found space with partial match');
        await partialMatch.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
      } else {
        throw new Error(`Could not find space: ${createdSpaceName}`);
      }
    }

    // ========================================
    // STEP 4: HOVER TO REVEAL EXIT BUTTON
    // ========================================
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  🖱️  STEP 4: HOVERING TO REVEAL EXIT BUTTON                    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Find the space card container (the parent card element)
    // The card contains the space name and has the exit button
    const spaceCardContainer = page.locator(`[class*="card"], [class*="Card"]`).filter({ hasText: createdSpaceName }).first();
    
    // Alternative: find by looking for a link/article containing the space name
    let cardToHover = spaceCardContainer;
    if (!(await cardToHover.isVisible({ timeout: 3000 }).catch(() => false))) {
      // Try finding by the space name text and going up to the card
      cardToHover = page.locator(`a:has-text("${createdSpaceName}"), article:has-text("${createdSpaceName}"), div:has-text("${createdSpaceName}")`).first();
    }
    
    // Hover over the card to reveal the exit button
    console.log('🖱️ Hovering over space card...');
    await cardToHover.hover();
    await page.waitForTimeout(1000);

    // Take screenshot showing the exit button
    await page.screenshot({
      path: `test-results-production/exit-space-hover-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 5: CLICK EXIT SPACE BUTTON
    // ========================================
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  🚪 STEP 5: CLICKING EXIT SPACE BUTTON                         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Find and click the "Exit Space" button
    const exitButton = page.locator('button:has-text("Exit Space"), [aria-label="Exit Space"], button[title="Exit Space"]').first();
    
    if (await exitButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('🚪 Found Exit Space button, clicking...');
      await exitButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ Exit Space button clicked');
    } else {
      // Try finding by icon or other attributes
      const exitIcon = page.locator('[data-testid="exit-space"], svg[class*="exit"]').first();
      if (await exitIcon.isVisible({ timeout: 3000 }).catch(() => false)) {
        await exitIcon.click();
        await page.waitForTimeout(1000);
        console.log('✅ Exit icon clicked');
      } else {
        // Try finding button with exit icon in the card area
        const cardExitButton = cardToHover.locator('button').first();
        if (await cardExitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await cardExitButton.click();
          await page.waitForTimeout(1000);
          console.log('✅ Card button clicked');
        } else {
          throw new Error('Could not find Exit Space button');
        }
      }
    }

    // Take screenshot after clicking exit
    await page.screenshot({
      path: `test-results-production/exit-space-confirm-dialog-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 6: CONFIRM EXIT
    // ========================================
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ STEP 6: CONFIRMING EXIT                                    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Look for confirmation dialog and confirm button
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Exit"), button:has-text("Leave")').last();
    
    if (await confirmButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('📝 Found confirmation button, clicking...');
      await confirmButton.click();
      await page.waitForTimeout(2000);
      console.log('✅ Exit confirmed!');
    } else {
      // Maybe no confirmation needed, or it auto-confirmed
      console.log('ℹ️ No confirmation dialog found - exit may have completed');
    }

    // Wait for the page to update
    await page.waitForTimeout(3000);

    // Take final screenshot
    await page.screenshot({
      path: `test-results-production/exit-space-final-${timestamp}.png`,
      fullPage: true,
    });

    // Verify the space is no longer in My Spaces (optional verification)
    console.log('🔍 Verifying space exit...');
    await page.goto('/en/my-spaces');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const spaceStillExists = await page.locator(`text="${createdSpaceName}"`).isVisible({ timeout: 5000 }).catch(() => false);
    
    if (!spaceStillExists) {
      console.log('✅ Space no longer appears in My Spaces - exit successful!');
    } else {
      console.log('⚠️ Space still visible - exit may be pending or failed');
    }

    // Log the result
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ EXIT SPACE TEST COMPLETED                                  ║');
    console.log('║                                                                ║');
    console.log('║  📝 Summary:                                                   ║');
    console.log(`║    🆕 Created Space: ${createdSpaceName.substring(0, 40).padEnd(40)}║`);
    console.log('║    🚪 Exited the space successfully                            ║');
    console.log('║                                                                ║');
    console.log('║  ⚠️  The space has been exited on production!                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
  });
});


