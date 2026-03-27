import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, '../../../.auth/production-user.json');

/**
 * Production Authentication Setup
 *
 * This script opens a browser and waits for you to log in manually.
 * Once logged in, it saves your authentication state for use in other tests.
 *
 * Run with:
 *   npx playwright test --config=apps/web-e2e/playwright.production.config.ts --project=auth-setup --headed
 */
setup('authenticate on production', async ({ page, context }) => {
  // Ensure .auth directory exists
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Check if we already have valid auth state
  if (fs.existsSync(AUTH_FILE)) {
    console.log('🔑 Found existing auth state, verifying...');

    // Load existing state - need to restore BOTH cookies AND localStorage
    const savedState = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));

    // Add cookies
    if (savedState.cookies && savedState.cookies.length > 0) {
      await context.addCookies(savedState.cookies);
    }

    // Navigate first, then inject localStorage (localStorage is domain-specific)
    await page.goto('https://app.hypha.earth/en/my-spaces');

    // Restore localStorage from saved state
    if (savedState.origins && savedState.origins.length > 0) {
      for (const origin of savedState.origins) {
        if (origin.localStorage && origin.localStorage.length > 0) {
          await page.evaluate((items) => {
            for (const item of items) {
              localStorage.setItem(item.name, item.value);
            }
          }, origin.localStorage);
        }
      }
      // Reload page to apply localStorage auth state
      await page.reload();
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Wait for auth state to be applied

    const signInButtonCheck = page.getByRole('button', { name: /sign in/i });
    const isSignInVisible = await signInButtonCheck
      .isVisible({ timeout: 5000 })
      .catch(() => true);

    if (!isSignInVisible) {
      console.log(
        '✅ Existing auth state is valid! (Sign-in button not visible)',
      );
      return;
    }

    console.log('⚠️ Existing auth state expired, need to re-authenticate...');
  }

  // Navigate to production
  console.log('🌐 Opening https://app.hypha.earth...');
  await page.goto('https://app.hypha.earth/en/network');
  await page.waitForLoadState('networkidle');

  // Look for sign in button
  const signInButton = page.getByRole('button', { name: /sign in/i });

  console.log('');
  console.log(
    '╔════════════════════════════════════════════════════════════════╗',
  );
  console.log(
    '║                                                                ║',
  );
  console.log(
    '║   👋 MANUAL LOGIN REQUIRED                                     ║',
  );
  console.log(
    '║                                                                ║',
  );
  console.log(
    '║   1. Click "Sign in" in the browser                            ║',
  );
  console.log(
    '║   2. Complete the Privy login flow                             ║',
  );
  console.log(
    '║   3. Wait until you see your profile avatar                    ║',
  );
  console.log(
    '║   4. The test will automatically save your auth state          ║',
  );
  console.log(
    '║                                                                ║',
  );
  console.log(
    '║   ⏱️  You have 2 minutes to complete login                      ║',
  );
  console.log(
    '║                                                                ║',
  );
  console.log(
    '╚════════════════════════════════════════════════════════════════╝',
  );
  console.log('');

  // Wait for user to log in - detect by sign-in button disappearing OR profile elements appearing
  // Multiple selectors for robustness since data-testid might not be deployed
  const profileIndicators = page.locator(
    // Avatar images in the header area, dropdown triggers, or any profile-like element
    'header img[alt*="avatar" i], header img[alt*="profile" i], header img[alt*="logo" i], [class*="Avatar"], [class*="avatar"], button:has(img[class*="rounded-full"])',
  );

  console.log('👀 Watching for login... (sign-in button should disappear)');

  try {
    // Poll for login state - either sign-in disappears or profile appears
    let loggedIn = false;
    const startTime = Date.now();
    const timeout = 120000; // 2 minutes

    while (!loggedIn && Date.now() - startTime < timeout) {
      // Check if sign-in button is gone (means user logged in)
      const signInVisible = await signInButton.isVisible().catch(() => false);
      const profileVisible = await profileIndicators
        .first()
        .isVisible()
        .catch(() => false);

      if (!signInVisible || profileVisible) {
        // Double-check by waiting a moment
        await page.waitForTimeout(2000);
        const signInStillVisible = await signInButton
          .isVisible()
          .catch(() => false);

        if (!signInStillVisible) {
          loggedIn = true;
          console.log('✅ Login detected! (Sign-in button disappeared)');
        }
      }

      if (!loggedIn) {
        await page.waitForTimeout(1000); // Check every second
      }
    }

    if (!loggedIn) {
      throw new Error('Timeout');
    }
  } catch {
    // Take a screenshot for debugging
    await page.screenshot({
      path: 'test-results-production/auth-timeout-debug.png',
      fullPage: true,
    });
    console.log(
      '📸 Debug screenshot saved to test-results-production/auth-timeout-debug.png',
    );
    throw new Error(
      'Login timeout - please run again and complete login faster',
    );
  }

  // Wait a bit for all auth state to settle
  await page.waitForTimeout(2000);

  // Save the authentication state
  await context.storageState({ path: AUTH_FILE });

  console.log('');
  console.log(`✅ Auth state saved to: ${AUTH_FILE}`);
  console.log('');
  console.log('You can now run production tests with:');
  console.log(
    '  npx playwright test --config=apps/web-e2e/playwright.production.config.ts --project=production-smoke',
  );
  console.log('');
});
