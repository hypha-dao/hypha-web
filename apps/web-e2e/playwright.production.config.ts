import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * Production E2E Testing Configuration
 *
 * ⚠️  WARNING: These tests run against PRODUCTION (app.hypha.earth)
 * ⚠️  Tests may CREATE REAL DATA (Spaces, Proposals, etc.)
 * ⚠️  Only run these tests intentionally!
 *
 * Usage:
 *   npx playwright test --config=apps/web-e2e/playwright.production.config.ts
 *
 * Authentication:
 *   Before running, you must save your auth state:
 *   1. Run: npx playwright test --config=apps/web-e2e/playwright.production.config.ts --project=auth-setup --headed
 *   2. Log in manually when the browser opens
 *   3. The auth state will be saved to .auth/production-user.json
 */

const PRODUCTION_URL = 'https://app.hypha.earth';
const AUTH_STATE_FILE = path.join(__dirname, '.auth/production-user.json');

export default defineConfig({
  testDir: './src/specs/production',

  /* Global timeout - longer for production */
  timeout: 120000,

  /* Expect timeout */
  expect: {
    timeout: 15000,
  },

  /* Fail fast - stop on first failure in production */
  maxFailures: 1,

  /* No retries in production - we want to know immediately if something fails */
  retries: 0,

  /* Run tests serially in production */
  workers: 1,

  /* Reporter */
  reporter: [
    [
      'html',
      { open: 'on-failure', outputFolder: 'playwright-report-production' },
    ],
    ['list'],
  ],

  /* Shared settings */
  use: {
    baseURL: PRODUCTION_URL,

    /* Collect trace always for production debugging */
    trace: 'on',

    /* Capture screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video always for production tests */
    video: 'on',

    /* Longer timeouts for production */
    navigationTimeout: 60000,
    actionTimeout: 30000,
  },

  /* NO webServer - we're testing against live production */

  projects: [
    /**
     * Authentication Setup
     * Run this first to save your login state
     */
    {
      name: 'auth-setup',
      testMatch: /production-auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    /**
     * Production smoke tests - runs auth-setup first to verify
     */
    {
      name: 'production-smoke',
      testMatch: /.*\.prod\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STATE_FILE,
      },
    },

    /**
     * Production quick tests - uses saved auth WITHOUT re-verifying
     * Use this after you've already run auth-setup once
     */
    {
      name: 'production-quick',
      testMatch: /.*\.prod\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STATE_FILE,
      },
    },

    /**
     * Production tests without auth (public pages only)
     */
    {
      name: 'production-public',
      testMatch: /.*\.public\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },
  ],

  outputDir: 'test-results-production/',
});
