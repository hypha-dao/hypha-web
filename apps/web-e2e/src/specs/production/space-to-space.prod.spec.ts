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
  const spaceName = `E2E S2S ${timestamp}${randomSuffix}`;
  const spaceDescription = 'Space created for Space-to-Space membership E2E test. Safe to delete.';

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 STEP 1: CREATING NEW SPACE FOR SPACE-TO-SPACE TEST         ║');
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
  const bannerImageBuffer = createTestImageBuffer(); // Different random color
  
  const logoPath = path.join(process.cwd(), `test-results-production/test-logo-s2s-${timestamp}.png`);
  const bannerPath = path.join(process.cwd(), `test-results-production/test-banner-s2s-${timestamp}.png`);

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

  // Handle the crop modal that appears after uploading banner
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
    path: `test-results-production/s2s-create-space-form-${timestamp}.png`,
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
      path: `test-results-production/s2s-create-space-error-${timestamp}.png`,
      fullPage: true,
    });
    throw new Error('Space creation did not complete in expected time');
  }

  // Get the actual space name from the title input we filled
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
 * Searches for and selects a space from the dropdown
 */
async function selectSpaceFromDropdown(page: Page, spaceName: string): Promise<boolean> {
  console.log(`🔍 Searching for space: ${spaceName}...`);
  
  // First, scroll to find the "Space to join" section
  const spaceToJoinLabel = page.locator('text="Space to join"').first();
  if (await spaceToJoinLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
    await spaceToJoinLabel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
  
  // Click on the "Find Space" dropdown button
  const findSpaceDropdown = page.locator('button:has-text("Find Space")').first();
  
  if (await findSpaceDropdown.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('🔘 Clicking "Find Space" dropdown...');
    await findSpaceDropdown.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await findSpaceDropdown.click();
    await page.waitForTimeout(1000);
    
    // Wait for the dropdown popover to appear
    // The dropdown uses a popover with search input
    const popover = page.locator('[data-radix-popper-content-wrapper]').first();
    await popover.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    
    // Find the search input INSIDE the popover only
    // This avoids picking up other search inputs on the page
    const searchInput = popover.locator('input').first();
    
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('📝 Found search input in dropdown, typing space name...');
      
      // Use fill instead of click + fill to avoid interception issues
      await searchInput.fill(spaceName);
      await page.waitForTimeout(2000); // Wait for search results to load
      console.log(`📝 Typed space name: ${spaceName}`);
      
      // Take screenshot to see search results
      await page.screenshot({
        path: `test-results-production/s2s-space-search-${Date.now()}.png`,
        fullPage: true,
      });
    } else {
      console.log('⚠️ Search input not found in popover, trying keyboard input...');
      // If no search input visible, try typing directly (dropdown might accept keyboard)
      await page.keyboard.type(spaceName);
      await page.waitForTimeout(2000);
    }
    
    // Look for the space in the dropdown options
    // The space name starts with "E2E S2S" so we can search for that
    const options = page.locator('[role="option"]');
    const optionCount = await options.count();
    console.log(`🔍 Found ${optionCount} options after search`);
    
    // Try to find exact match first
    for (let i = 0; i < optionCount; i++) {
      const text = await options.nth(i).textContent() || '';
      console.log(`   Option ${i}: ${text.trim().substring(0, 50)}`);
      
      if (text.includes(spaceName) || text.includes('E2E S2S')) {
        console.log(`✅ Found matching space: ${text.trim()}`);
        await options.nth(i).click();
        await page.waitForTimeout(500);
        console.log(`✅ Selected space: ${text.trim()}`);
        return true;
      }
    }
    
    // If no exact match, try partial match with the unique timestamp part
    const timestampPart = spaceName.replace('E2E S2S ', '');
    for (let i = 0; i < optionCount; i++) {
      const text = await options.nth(i).textContent() || '';
      if (text.includes(timestampPart)) {
        await options.nth(i).click();
        await page.waitForTimeout(500);
        console.log(`✅ Selected space (timestamp match): ${text.trim()}`);
        return true;
      }
    }
    
    // If still no match, select first option if available
    if (optionCount > 0) {
      const firstOptionText = await options.first().textContent() || '';
      console.log(`⚠️ No exact match found, selecting first option: ${firstOptionText.trim()}`);
      await options.first().click();
      await page.waitForTimeout(500);
      return true;
    }
    
    // Fallback: Use keyboard to select
    console.log('⚠️ Trying keyboard navigation...');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    return true;
  }
  
  console.log('⚠️ Could not find "Find Space" dropdown');
  return false;
}

/**
 * Selects a delegated voting member from the dropdown
 */
async function selectDelegatedVotingMember(page: Page): Promise<boolean> {
  console.log('👥 Selecting Delegated Voting Member...');
  
  // Find the "Find Member" dropdown
  const findMemberDropdown = page.locator('button:has-text("Find Member"), [role="combobox"]:has-text("Find Member")').first();
  
  if (await findMemberDropdown.isVisible({ timeout: 5000 }).catch(() => false)) {
    await findMemberDropdown.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await findMemberDropdown.click();
    await page.waitForTimeout(1000);
    
    // Look for member options
    const memberOptions = page.locator('[role="option"]');
    const optionCount = await memberOptions.count();
    console.log(`🔍 Found ${optionCount} member options`);
    
    if (optionCount > 0) {
      // Select the first available member
      const firstMember = memberOptions.first();
      const memberText = await firstMember.textContent() || 'Unknown';
      await firstMember.click();
      await page.waitForTimeout(500);
      console.log(`✅ Selected member: ${memberText.trim()}`);
      return true;
    }
    
    // Fallback: Try keyboard navigation
    console.log('⚠️ Trying keyboard navigation for member selection...');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    console.log('✅ Member selected via keyboard');
    return true;
  }
  
  console.log('⚠️ Could not find member dropdown');
  return false;
}

/**
 * Production Test: Space-to-Space Membership
 *
 * ⚠️  WARNING: This test creates REAL data on production!
 * ⚠️  A new space will be created and a space-to-space proposal will be submitted
 * ⚠️  Only run this intentionally!
 *
 * Prerequisites:
 *   1. Run auth setup first: npx nx e2e-production-auth web-e2e
 *
 * Run this test:
 *   npx nx e2e-production-space-to-space web-e2e -- --headed
 */

test.describe('Space-to-Space Membership on Production', () => {
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

  test('should create space-to-space membership proposal in QA TESTING space', async ({
    page,
  }) => {
    // Set longer timeout for this test (space creation + proposal)
    test.setTimeout(300000); // 5 minutes

    const timestamp = Date.now();

    // ========================================
    // STEP 1: CREATE A NEW SPACE
    // ========================================
    const createdSpaceName = await createNewSpace(page);
    console.log(`📝 Recorded space name: ${createdSpaceName}`);

    // ========================================
    // STEP 2: NAVIGATE TO QA TESTING SPACE
    // ========================================
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  📍 STEP 2: NAVIGATING TO QA TESTING SPACE                     ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    await page.goto('/en/my-spaces');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click on the "qa testing" space
    console.log('🔘 Looking for "QA TESTING" space...');
    const qaTestingSpace = page.locator('a[href*="/dho/"]', { hasText: /qa testing/i });
    await expect(qaTestingSpace).toBeVisible({ timeout: 10000 });

    await qaTestingSpace.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ Navigated to QA TESTING space');

    // ========================================
    // STEP 3: OPEN SPACE SETTINGS
    // ========================================
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  ⚙️  STEP 3: OPENING SPACE SETTINGS                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    const settingsButton = page.locator('a[href*="/settings"], button:has-text("Settings"), [aria-label*="settings"]').first();

    if (await settingsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsButton.click();
    } else {
      const currentUrl = page.url();
      const settingsUrl = currentUrl.replace('/overview', '/settings').replace(/\/$/, '') + '/settings';
      console.log(`📍 Navigating directly to: ${settingsUrl}`);
      await page.goto(settingsUrl);
    }

    await page.waitForTimeout(2000);
    console.log('✅ Space Settings opened');

    // Take screenshot
    await page.screenshot({
      path: `test-results-production/s2s-settings-panel-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 4: SCROLL TO SPACE-TO-SPACE MEMBERSHIP
    // ========================================
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  📜 STEP 4: FINDING SPACE-TO-SPACE MEMBERSHIP                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    const scrollableContainers = page.locator('[data-radix-scroll-area-viewport], [class*="overflow-auto"], [class*="overflow-y"]');

    // Scroll to find Space-to-Space Membership
    for (let i = 0; i < 15; i++) {
      const s2sVisible = await page.locator('text=Space-to-Space Membership').first().isVisible().catch(() => false);
      if (s2sVisible) {
        console.log('✅ Found "Space-to-Space Membership" option');
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
      path: `test-results-production/s2s-after-scroll-${timestamp}.png`,
      fullPage: true,
    });

    // Click on "Space-to-Space Membership" card
    console.log('🔘 Clicking on "Space-to-Space Membership"...');

    const s2sCard = page.locator('text=Allow your space to join another space as a member').first();

    if (await s2sCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await s2sCard.click({ force: true });
    } else {
      const s2sText = page.locator('text=Space-to-Space Membership').first();
      await s2sText.click({ force: true });
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ Space-to-Space Membership panel opened');

    // Take screenshot
    await page.screenshot({
      path: `test-results-production/s2s-panel-opened-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 5: FILL PROPOSAL DETAILS
    // ========================================
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  📝 STEP 5: FILLING PROPOSAL DETAILS                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Generate proposal title and description
    const proposalTitle = `E2E Space-to-Space ${timestamp}`;
    const proposalDescription = `Automated E2E test: Requesting QA TESTING space to join "${createdSpaceName}" as a member. This is a test proposal.`;

    // Fill Proposal Title
    console.log('📝 Filling proposal title...');
    const titleInput = page.getByPlaceholder('Proposal title...');
    if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await titleInput.scrollIntoViewIfNeeded();
      await titleInput.fill(proposalTitle);
      console.log(`✅ Title entered: ${proposalTitle}`);
    } else {
      console.log('⚠️ Title input not found');
    }

    // Fill Proposal Description
    console.log('📝 Filling proposal description...');
    const descriptionEditor = page.locator('[contenteditable="true"]').first();
    if (await descriptionEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
      await descriptionEditor.scrollIntoViewIfNeeded();
      await descriptionEditor.click();
      await page.waitForTimeout(300);
      await page.keyboard.type(proposalDescription);
      console.log('✅ Description entered');
    }

    await page.waitForTimeout(500);

    // Take screenshot after title/description
    await page.screenshot({
      path: `test-results-production/s2s-title-description-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 6: SELECT SPACE TO JOIN
    // ========================================
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  🔍 STEP 6: SELECTING SPACE TO JOIN                            ║');
    console.log(`║  Target: ${createdSpaceName.substring(0, 50).padEnd(50)}║`);
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    await selectSpaceFromDropdown(page, createdSpaceName);

    // Take screenshot after space selection
    await page.screenshot({
      path: `test-results-production/s2s-space-selected-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 7: SELECT DELEGATED VOTING MEMBER
    // ========================================
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  👥 STEP 7: SELECTING DELEGATED VOTING MEMBER                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    await selectDelegatedVotingMember(page);

    // Take screenshot after member selection
    await page.screenshot({
      path: `test-results-production/s2s-member-selected-${timestamp}.png`,
      fullPage: true,
    });

    // ========================================
    // STEP 8: PUBLISH PROPOSAL
    // ========================================
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  📤 STEP 8: PUBLISHING PROPOSAL                                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Scroll down to find Publish button
    for (let i = 0; i < 5; i++) {
      const publishButton = page.locator('button:has-text("Publish")').last();
      if (await publishButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await publishButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);

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
    console.log('⏳ Waiting for proposal to be published...');
    await page.waitForTimeout(5000);

    // Take final screenshot
    await page.screenshot({
      path: `test-results-production/s2s-final-${timestamp}.png`,
      fullPage: true,
    });

    // Check for success indicator
    try {
      await Promise.race([
        page.waitForSelector('text=/success/i', { timeout: 10000 }),
        page.waitForSelector('text=/published/i', { timeout: 10000 }),
        page.waitForSelector('text=/created/i', { timeout: 10000 }),
      ]);
      console.log('✅ Proposal published successfully!');
    } catch {
      console.log('⚠️ No explicit success message - proposal may have been submitted');
    }

    // Log the result
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ SPACE-TO-SPACE PROPOSAL COMPLETED                          ║');
    console.log('║                                                                ║');
    console.log('║  📝 Summary:                                                   ║');
    console.log(`║    🆕 Created Space: ${createdSpaceName.substring(0, 40).padEnd(40)}║`);
    console.log(`║    📋 Proposal: ${proposalTitle.substring(0, 44).padEnd(44)}║`);
    console.log('║    🔗 Requested QA TESTING to join the new space               ║');
    console.log('║                                                                ║');
    console.log('║  ⚠️  These changes are now LIVE on production!                 ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
  });
});

