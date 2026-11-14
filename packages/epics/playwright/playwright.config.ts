import { defineConfig, devices } from '@playwright/test';

/**
 * Standalone WebKit run for the chat clamp. Not part of `pnpm e2e`
 * (that config starts the Next server and only looks in apps/web-e2e).
 */
export default defineConfig({
  testDir: '.',
  testMatch: /message-text-clamp.webkit.spec.ts/,
  timeout: 30_000,
  retries: 0,
  projects: [
    {
      name: 'webkit-iphone-14',
      use: { ...devices['iPhone 14'] },
    },
  ],
});
