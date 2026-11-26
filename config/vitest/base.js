// Shared Vitest settings for every package with unit tests.
// Conventions: docs/development/testing.md
import { defineConfig, mergeConfig } from 'vitest/config';

/**
 * Tests that need a real external service. They are excluded from the unit
 * run (`pnpm test`, the CI job) and run with `pnpm test:integration`.
 * - `*.db.integration.test.ts`: a real Postgres (`BRANCH_DB_URL` / `DEFAULT_DB_URL`).
 * - `*.browser.test.ts(x)`: a locally installed Chrome.
 */
export const integrationTestPatterns = [
  'src/**/*.db.integration.test.{ts,tsx}',
  'src/**/*.browser.test.{ts,tsx}',
];

// Child processes, not worker threads: native code such as pdf.js crashed
// the thread pool (segfault, core). This is the Vitest 2+ default.
const pool = 'forks';

// jsdom component tests run 2-3x slower when every package runs at once
// (turbo, CI); the 5 s default made the slowest (~5 s alone) flaky. A real
// hang still fails.
const testTimeout = 15_000;

const unitBase = defineConfig({
  test: {
    pool,
    testTimeout,
    // Node by default; a file that needs the DOM opts in with a
    // `// @vitest-environment jsdom` comment at the top.
    environment: 'node',
    // Every test file under src runs: no folder lists to keep up to date.
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', ...integrationTestPatterns],
  },
});

const integrationBase = defineConfig({
  test: {
    pool,
    environment: 'node',
    include: integrationTestPatterns,
    exclude: ['**/node_modules/**', '**/dist/**'],
    passWithNoTests: true,
  },
});

/** Unit-test config: the shared base merged with package-specific settings. */
export function defineUnitConfig(overrides = {}) {
  return mergeConfig(unitBase, overrides);
}

/** Integration-test config (`test:integration`), same overrides as the unit one. */
export function defineIntegrationConfig(overrides = {}) {
  return mergeConfig(integrationBase, overrides);
}
