import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import * as path from 'path';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://127.0.0.1:3000';

// Auth state file paths
const STORAGE_STATE_DIR = path.join(__dirname, '.auth');
const AUTHENTICATED_STATE = path.join(
  STORAGE_STATE_DIR,
  'authenticated-user.json',
);

/**
 * Enhanced Playwright configuration with authentication support
 *
 * Projects:
 * - setup: Performs initial authentication setup (if needed)
 * - authenticated: Tests that require a logged-in user
 * - unauthenticated: Tests for logged-out scenarios
 * - chromium/firefox/webkit: Browser-specific runs
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),

  /* Global test timeout */
  timeout: 60000,

  /* Expect timeout for assertions */
  expect: {
    timeout: 10000,
  },

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Reporter configuration */
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['html', { open: 'on-failure' }]],

  /* Shared settings for all the projects below */
  use: {
    baseURL,

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Capture screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'on-first-retry',

    /* Navigation timeout */
    navigationTimeout: 30000,

    /* Action timeout */
    actionTimeout: 15000,
  },

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npx nx start web',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    cwd: workspaceRoot,
    timeout: 120000, // 2 minutes for server to start
  },

  /* Test projects configuration */
  projects: [
    /**
     * Setup project - runs before authenticated tests
     * Creates authentication state if needed
     */
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    /**
     * Authenticated tests - uses saved auth state
     * These tests run as a logged-in user
     */
    {
      name: 'authenticated',
      testMatch: /.*\.auth\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        // Use saved auth state - comment out if using test mode instead
        // storageState: AUTHENTICATED_STATE,
      },
    },

    /**
     * Unauthenticated tests - no auth state
     * Tests for logged-out user experience
     */
    {
      name: 'unauthenticated',
      testMatch: /.*\.unauth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },

    /**
     * All tests - default project
     * Runs all spec files
     */
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      testIgnore: /.*\.(auth|unauth|setup)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    /* Firefox browser tests */
    {
      name: 'firefox',
      testMatch: /.*\.spec\.ts/,
      testIgnore: /.*\.(auth|unauth|setup)\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },

    /* WebKit browser tests */
    {
      name: 'webkit',
      testMatch: /.*\.spec\.ts/,
      testIgnore: /.*\.(auth|unauth|setup)\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },

    /* Mobile viewport tests - uncomment to enable */
    // {
    //   name: 'mobile-chrome',
    //   testMatch: /.*\.spec\.ts/,
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'mobile-safari',
    //   testMatch: /.*\.spec\.ts/,
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  /* Output directory for test artifacts */
  outputDir: 'test-results/',
});
