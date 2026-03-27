import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const authFile = path.join(__dirname, '../../../.auth/authenticated-user.json');

/**
 * Authentication Setup
 *
 * This setup script runs before authenticated tests to ensure
 * authentication state is available.
 *
 * For Privy test mode, this creates a mock auth state file.
 * For real authentication, you would perform actual login here.
 */
setup('create authentication state', async ({ page }) => {
  const authDir = path.dirname(authFile);

  // Create .auth directory if it doesn't exist
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // For Privy test mode, we create a minimal storage state
  // The actual auth injection happens via the fixture
  const mockStorageState = {
    cookies: [],
    origins: [
      {
        origin: process.env.BASE_URL || 'http://127.0.0.1:3000',
        localStorage: [
          {
            name: 'privy:test_mode',
            value: 'true',
          },
        ],
      },
    ],
  };

  // Write the storage state file
  fs.writeFileSync(authFile, JSON.stringify(mockStorageState, null, 2));

  console.log(`Auth setup complete. State file: ${authFile}`);
});

/**
 * Optional: Real authentication setup
 * Uncomment this if you need to perform actual Privy login
 */
// setup('authenticate via Privy', async ({ page, context }) => {
//   // Navigate to the app
//   await page.goto('/');
//
//   // Click sign in button
//   await page.getByRole('button', { name: /sign in/i }).click();
//
//   // Wait for Privy modal
//   await page.waitForSelector('[id*="privy"]', { timeout: 10000 });
//
//   // At this point, you would need to:
//   // 1. Enter email or use social login
//   // 2. Complete OTP verification (for email)
//   // 3. Wait for authentication to complete
//
//   // This is challenging to automate because:
//   // - Email OTP requires access to email
//   // - Social logins redirect to third parties
//
//   // Save the authenticated state
//   await context.storageState({ path: authFile });
// });
