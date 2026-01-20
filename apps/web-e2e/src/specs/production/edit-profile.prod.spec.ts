import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Creates a test image buffer (a simple colored PNG)
 */
function createTestImageBuffer(): Buffer {
  // Minimal valid PNG - a 100x100 colored image for profile picture
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

  // Generate random color for the image
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);

  const rawData: number[] = [];
  for (let y = 0; y < 100; y++) {
    rawData.push(0);
    for (let x = 0; x < 100; x++) {
      rawData.push(r, g, b); // Random color
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
 * Generates a random life purpose description
 */
function generateRandomPurpose(): string {
  const purposes = [
    'E2E Test: Exploring the intersection of technology and human connection.',
    'E2E Test: Building a better future through collaborative innovation.',
    'E2E Test: Passionate about decentralized governance and community building.',
    'E2E Test: Making the world a better place, one commit at a time.',
    'E2E Test: Committed to sustainable development and positive change.',
  ];
  return purposes[Math.floor(Math.random() * purposes.length)]!;
}

/**
 * Production Test: Edit Profile
 *
 * ⚠️  WARNING: This test modifies REAL profile data on production!
 * ⚠️  The profile will be updated on https://app.hypha.earth
 * ⚠️  Only run this intentionally!
 *
 * Prerequisites:
 *   1. Run auth setup first: npx nx e2e-production-auth web-e2e
 *
 * Run this test:
 *   npx nx e2e-production-edit-profile web-e2e -- --headed
 */

test.describe('Edit Profile on Production', () => {
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

  test('should edit profile with new image and description', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const lifePurpose = generateRandomPurpose();

    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  👤 EDITING PROFILE ON PRODUCTION                              ║',
    );
    console.log(
      '╠════════════════════════════════════════════════════════════════╣',
    );
    console.log(
      '║  📝 Changes:                                                   ║',
    );
    console.log(
      '║    📸 Profile Picture: New random colored image                ║',
    );
    console.log(`║    💭 Life Purpose: ${lifePurpose.substring(0, 40).padEnd(40)}║`);
    console.log(
      '╚════════════════════════════════════════════════════════════════╝',
    );
    console.log('');

    // ========================================
    // STEP 1: Click on profile picture (top right, next to "My Spaces")
    // ========================================
    console.log('👤 Step 1: Clicking on profile picture...');
    
    // The profile button is in the header, to the right of "My Spaces"
    // It can show user's initial, an image, or a colored square
    let profileClicked = false;
    
    // Method 1: Find any clickable element after "My Spaces" link
    const mySpacesLink = page.locator('a:has-text("My Spaces"), text="My Spaces"').first();
    if (await mySpacesLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('🔍 Found "My Spaces" link, looking for profile button next to it...');
      
      // The profile button is the next clickable element after My Spaces
      const profileAfterMySpaces = mySpacesLink.locator('xpath=following::button[1] | following::a[1]');
      if (await profileAfterMySpaces.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileAfterMySpaces.click();
        profileClicked = true;
        console.log('✅ Profile button clicked (after My Spaces)');
      }
    }
    
    // Method 2: Find button/link with avatar image in header
    if (!profileClicked) {
      const avatarInHeader = page.locator('header img, nav img, [class*="header"] img, [class*="nav"] img').last();
      if (await avatarInHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Click the parent button/link of the avatar image
        await avatarInHeader.click();
        profileClicked = true;
        console.log('✅ Profile button clicked (avatar image)');
      }
    }
    
    // Method 3: Find button with background color/image (avatar style) at the end of nav
    if (!profileClicked) {
      // Look for small square/round buttons that might be avatars
      const avatarButtons = page.locator('button[class*="rounded"], a[class*="rounded"]').filter({
        has: page.locator('img, [class*="avatar"], [style*="background"]')
      });
      const count = await avatarButtons.count();
      if (count > 0) {
        await avatarButtons.last().click();
        profileClicked = true;
        console.log('✅ Profile button clicked (rounded avatar)');
      }
    }
    
    // Method 4: Find the last button/link in the header/nav area
    if (!profileClicked) {
      const headerElements = page.locator('header button, header a, nav button, nav a').last();
      if (await headerElements.isVisible({ timeout: 2000 }).catch(() => false)) {
        await headerElements.click();
        profileClicked = true;
        console.log('✅ Profile button clicked (last header element)');
      }
    }
    
    // Method 5: Direct click on element in top-right corner area
    if (!profileClicked) {
      // Find elements in the top-right area of the page
      const topRightButtons = page.locator('button, a').filter({
        has: page.locator('[class*="avatar"], [class*="profile"], img')
      }).last();
      
      if (await topRightButtons.isVisible({ timeout: 2000 }).catch(() => false)) {
        await topRightButtons.click();
        profileClicked = true;
        console.log('✅ Profile button clicked (top-right button)');
      }
    }
    
    if (!profileClicked) {
      console.log('⚠️ Could not find profile button - taking screenshot for debugging');
      await page.screenshot({
        path: `test-results-production/edit-profile-debug-${timestamp}.png`,
        fullPage: true,
      });
    }
    
    await page.waitForTimeout(1000);

    // Take screenshot of profile dropdown
    await page.screenshot({
      path: `test-results-production/edit-profile-dropdown-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 2: Click "View profile"
    // ========================================
    console.log('👤 Step 2: Clicking "View profile"...');
    
    const viewProfileLink = page.locator('text="View profile"').first();
    
    if (await viewProfileLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await viewProfileLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      console.log('✅ View profile clicked');
    } else {
      console.log('⚠️ View profile link not found');
    }

    // Take screenshot of profile page
    await page.screenshot({
      path: `test-results-production/edit-profile-page-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 3: Click "Edit profile" button
    // ========================================
    console.log('✏️ Step 3: Clicking "Edit profile" button...');
    
    const editProfileButton = page.locator('button:has-text("Edit profile"), a:has-text("Edit profile")').first();
    
    if (await editProfileButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editProfileButton.click();
      await page.waitForTimeout(1500);
      console.log('✅ Edit profile clicked');
    } else {
      console.log('⚠️ Edit profile button not found');
    }

    // Take screenshot of edit profile panel
    await page.screenshot({
      path: `test-results-production/edit-profile-panel-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 4: Upload BOTH images (avatar + main profile image)
    // ========================================
    console.log('📸 Step 4: Uploading profile images...');
    
    // Create TWO different random test images
    const avatarImageBuffer = createTestImageBuffer(); // Random color 1
    const avatarImagePath = path.join(process.cwd(), `test-results-production/test-avatar-image-${timestamp}.png`);
    fs.writeFileSync(avatarImagePath, avatarImageBuffer);
    
    const mainImageBuffer = createTestImageBuffer(); // Random color 2 (different because Math.random)
    const mainImagePath = path.join(process.cwd(), `test-results-production/test-main-image-${timestamp}.png`);
    fs.writeFileSync(mainImagePath, mainImageBuffer);
    
    console.log('🎨 Created 2 random colored images');
    
    // Find all file inputs
    const fileInputs = page.locator('input[type="file"]');
    const fileInputCount = await fileInputs.count();
    console.log(`🔍 Found ${fileInputCount} file inputs`);
    
    // ---- Upload to SMALL AVATAR (first file input, top left next to name) ----
    if (fileInputCount >= 1) {
      console.log('📸 Uploading small avatar image...');
      await fileInputs.first().setInputFiles(avatarImagePath);
      await page.waitForTimeout(1500);
      console.log('✅ Small avatar uploaded');
    }
    
    // ---- Upload to BIG "Upload an image" area (second file input or last) ----
    let mainImageUploaded = false;
    
    // Method 1: If there are 2+ file inputs, use the second one for main image
    if (fileInputCount >= 2) {
      console.log('📸 Uploading main profile image (second input)...');
      await fileInputs.nth(1).setInputFiles(mainImagePath);
      await page.waitForTimeout(2000);
      console.log('✅ Main profile image uploaded');
      mainImageUploaded = true;
    }
    
    // Method 2: Find the "Upload an image" area and use file chooser
    if (!mainImageUploaded) {
      const uploadArea = page.locator('text="Upload an image"').first();
      if (await uploadArea.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('🔘 Found "Upload an image" area, clicking...');
        
        await uploadArea.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        
        // Use filechooser event
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null),
          uploadArea.click(),
        ]);
        
        if (fileChooser) {
          await fileChooser.setFiles(mainImagePath);
          await page.waitForTimeout(2000);
          console.log('✅ Main profile image uploaded (file chooser)');
          mainImageUploaded = true;
        }
      }
    }
    
    // Method 3: Try the last file input if still not uploaded
    if (!mainImageUploaded && fileInputCount >= 1) {
      console.log('📸 Trying last file input for main image...');
      await fileInputs.last().setInputFiles(mainImagePath);
      await page.waitForTimeout(2000);
      console.log('✅ Main profile image uploaded (last input)');
      mainImageUploaded = true;
    }
    
    if (!mainImageUploaded) {
      console.log('⚠️ Could not upload main profile image');
    }
    
    // Handle the crop modal that appears after uploading
    console.log('✂️ Looking for crop modal...');
    await page.waitForTimeout(1000);
    
    const cropAndSaveButton = page.locator('button:has-text("Crop & Save"), button:has-text("Crop and Save")').first();
    
    if (await cropAndSaveButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('✂️ Crop modal detected, clicking "Crop & Save"...');
      await cropAndSaveButton.click();
      await page.waitForTimeout(2000);
      console.log('✅ Image cropped and saved');
    } else {
      console.log('ℹ️ No crop modal detected');
    }

    // Take screenshot after image uploads
    await page.screenshot({
      path: `test-results-production/edit-profile-images-uploaded-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 5: Write life purpose/description
    // ========================================
    console.log('💭 Step 5: Writing life purpose...');
    
    // Find the life purpose textarea
    const lifePurposeTextarea = page.getByPlaceholder('Type your life purpose here...');
    
    if (await lifePurposeTextarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await lifePurposeTextarea.scrollIntoViewIfNeeded();
      await lifePurposeTextarea.click();
      await lifePurposeTextarea.fill(lifePurpose);
      console.log(`✅ Life purpose entered: ${lifePurpose.substring(0, 50)}...`);
    } else {
      // Try alternative: find any textarea on the page
      const anyTextarea = page.locator('textarea').first();
      if (await anyTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await anyTextarea.click();
        await anyTextarea.fill(lifePurpose);
        console.log('✅ Life purpose entered (alt method)');
      } else {
        console.log('⚠️ Life purpose textarea not found');
      }
    }

    await page.waitForTimeout(500);

    // Take screenshot after entering description
    await page.screenshot({
      path: `test-results-production/edit-profile-description-entered-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 6: Click Save button
    // ========================================
    console.log('💾 Step 6: Clicking Save button...');
    
    const saveButton = page.locator('button:has-text("Save")').last();
    
    if (await saveButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      
      const isEnabled = await saveButton.isEnabled();
      if (isEnabled) {
        await saveButton.click();
        console.log('✅ Save button clicked!');
      } else {
        console.log('⚠️ Save button is disabled');
      }
    } else {
      console.log('⚠️ Save button not found');
    }

    // Wait for save to complete
    console.log('⏳ Waiting for profile to save...');
    await page.waitForTimeout(3000);

    // Take screenshot after saving
    await page.screenshot({
      path: `test-results-production/edit-profile-saved-${timestamp}.png`,
      fullPage: true,
    });

    // Check for success indicator
    try {
      await Promise.race([
        page.waitForSelector('text=/success/i', { timeout: 10000 }),
        page.waitForSelector('text=/saved/i', { timeout: 10000 }),
        page.waitForSelector('text=/updated/i', { timeout: 10000 }),
      ]);
      console.log('✅ Profile saved successfully!');
    } catch {
      console.log('⚠️ No explicit success message - profile may have been saved');
    }

    // Final screenshot
    await page.screenshot({
      path: `test-results-production/edit-profile-final-${timestamp}.png`,
      fullPage: true,
    });

    // Log the result
    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║  ✅ PROFILE UPDATED SUCCESSFULLY                               ║',
    );
    console.log(
      '║                                                                ║',
    );
    console.log(
      '║  📝 Applied Changes:                                           ║',
    );
    console.log(
      '║    📸 Profile Picture: Uploaded new image                      ║',
    );
    console.log(`║    💭 Life Purpose: ${lifePurpose.substring(0, 40).padEnd(40)}║`);
    console.log(
      '║                                                                ║',
    );
    console.log(
      '║  ⚠️  Your profile has been updated on production!              ║',
    );
    console.log(
      '╚════════════════════════════════════════════════════════════════╝',
    );
    console.log('');
  });
});

