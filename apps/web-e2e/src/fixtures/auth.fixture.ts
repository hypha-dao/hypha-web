import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Privy Test Mode Authentication Fixture
 *
 * This fixture provides authentication utilities for E2E testing with Privy.
 * It supports multiple authentication strategies:
 *
 * 1. Test Mode: Bypasses Privy's OAuth flow by injecting mock auth state
 * 2. Storage State: Reuses saved browser state from manual login
 * 3. Manual Login: Automates the actual Privy login flow (for smoke tests)
 */

export type TestUser = {
  id: string;
  email: string;
  walletAddress: `0x${string}`;
  name?: string;
};

// Mock test users for different scenarios
export const TEST_USERS = {
  // Regular authenticated user
  member: {
    id: 'did:privy:test-member-user',
    email: 'test-member@hypha.earth',
    walletAddress:
      '0x1234567890123456789012345678901234567890' as `0x${string}`,
    name: 'Test Member',
  },
  // Space admin user
  admin: {
    id: 'did:privy:test-admin-user',
    email: 'test-admin@hypha.earth',
    walletAddress:
      '0x0987654321098765432109876543210987654321' as `0x${string}`,
    name: 'Test Admin',
  },
  // Non-member user (authenticated but not part of any space)
  guest: {
    id: 'did:privy:test-guest-user',
    email: 'test-guest@hypha.earth',
    walletAddress:
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
    name: 'Test Guest',
  },
} as const;

type TestUserKey = keyof typeof TEST_USERS;

export type AuthFixtures = {
  /**
   * Inject mock Privy authentication state into the page
   * This allows tests to run as if a user is logged in without going through OAuth
   */
  authenticateAs: (user: TestUser | TestUserKey) => Promise<void>;

  /**
   * Clear authentication state
   */
  clearAuth: () => Promise<void>;

  /**
   * Check if the current page shows authenticated state
   */
  isAuthenticated: () => Promise<boolean>;

  /**
   * Current test user (if authenticated)
   */
  currentUser: TestUser | null;

  /**
   * Test space configuration for testing proposals, voting etc.
   */
  testSpace: {
    slug: string;
    web3SpaceId: number;
    name: string;
  };
};

/**
 * Extended test instance with authentication fixtures
 */
export const test = base.extend<AuthFixtures>({
  currentUser: [null, { option: true }],

  testSpace: [
    {
      // Configure a test space that exists in your environment
      // Update these values to match a real space in your test/staging environment
      slug: 'hypha', // Replace with your test space slug
      web3SpaceId: 1, // Replace with actual web3SpaceId
      name: 'Hypha Test Space',
    },
    { option: true },
  ],

  authenticateAs: async ({ page }, use) => {
    let authenticatedUser: TestUser | null = null;

    const authenticate = async (userOrKey: TestUser | TestUserKey) => {
      const user =
        typeof userOrKey === 'string' ? TEST_USERS[userOrKey] : userOrKey;
      authenticatedUser = user;

      // Inject Privy test mode authentication state into localStorage
      // This mimics how Privy stores authentication data
      await page.addInitScript(
        (userData) => {
          // Mock Privy authentication state
          const privyAuthState = {
            authenticated: true,
            user: {
              id: userData.id,
              email: { address: userData.email },
              linkedAccounts: [
                {
                  type: 'email',
                  address: userData.email,
                },
                {
                  type: 'smart_wallet',
                  address: userData.walletAddress,
                  smartWalletType: 'coinbase_smart_wallet',
                },
              ],
            },
            ready: true,
          };

          // Store in localStorage (Privy's storage key pattern)
          localStorage.setItem(
            'privy:auth_state',
            JSON.stringify(privyAuthState),
          );

          // Also set a mock token for API authentication
          localStorage.setItem(
            'privy:token',
            JSON.stringify({
              accessToken: `test-token-${userData.id}`,
              refreshToken: `test-refresh-${userData.id}`,
              expiresAt: Date.now() + 3600000, // 1 hour from now
            }),
          );

          // Dispatch storage event to trigger Privy to pick up the state
          window.dispatchEvent(new Event('storage'));
        },
        {
          id: user.id,
          email: user.email,
          walletAddress: user.walletAddress,
          name: user.name,
        },
      );
    };

    await use(authenticate);
  },

  clearAuth: async ({ page }, use) => {
    const clear = async () => {
      await page.evaluate(() => {
        // Clear all Privy-related storage
        const keysToRemove = Object.keys(localStorage).filter(
          (key) => key.startsWith('privy:') || key.includes('privy'),
        );
        keysToRemove.forEach((key) => localStorage.removeItem(key));

        // Clear session storage as well
        const sessionKeysToRemove = Object.keys(sessionStorage).filter(
          (key) => key.startsWith('privy:') || key.includes('privy'),
        );
        sessionKeysToRemove.forEach((key) => sessionStorage.removeItem(key));

        // Trigger storage event
        window.dispatchEvent(new Event('storage'));
      });
    };

    await use(clear);
  },

  isAuthenticated: async ({ page }, use) => {
    const check = async () => {
      // Check for authenticated UI elements
      const profileButton = page.getByTestId('profile-button');
      const signInButton = page.getByRole('button', { name: /sign in/i });

      // If profile button is visible and sign in is not, user is authenticated
      const isProfileVisible = await profileButton
        .isVisible()
        .catch(() => false);
      const isSignInVisible = await signInButton.isVisible().catch(() => false);

      return isProfileVisible && !isSignInVisible;
    };

    await use(check);
  },
});

/**
 * Save current browser authentication state to a file
 * Use this after manual login to create reusable auth state
 */
export async function saveAuthState(
  context: BrowserContext,
  filename: string = 'authenticated-user.json',
) {
  const authDir = path.join(__dirname, '../../.auth');

  // Create .auth directory if it doesn't exist
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const filePath = path.join(authDir, filename);
  await context.storageState({ path: filePath });
  console.log(`Auth state saved to: ${filePath}`);
}

/**
 * Load authentication state from a file
 */
export function getAuthStatePath(filename: string = 'authenticated-user.json') {
  return path.join(__dirname, '../../.auth', filename);
}

export { expect };
