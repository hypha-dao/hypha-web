import { defineConfig } from 'vitest/config';

/**
 * The campaign suite talks to a real Postgres, so without a connection string
 * it cannot even be imported. Skipping it there keeps the suites that need
 * nothing — the Stripe webhook checks — runnable on a bare checkout, rather
 * than failing the whole run on a missing container.
 */
const hasDatabase = Boolean(
  process.env.BRANCH_DB_URL || process.env.DEFAULT_DB_URL,
);

if (!hasDatabase) {
  console.warn(
    '[vitest] No BRANCH_DB_URL / DEFAULT_DB_URL — skipping the campaign integration tests.',
  );
}

export default defineConfig({
  resolve: {
    // The server modules carry Next.js's `server-only` marker, which throws
    // outside a Server Component. Vitest is already server-side, so resolve it
    // the way React Server Components do.
    conditions: ['react-server', 'node', 'import', 'default'],
  },
  test: {
    // The campaign tests run against a real Postgres rather than mocks — the
    // behaviour worth checking (idempotency, the single-open-round constraint,
    // atomic ballot replacement) lives in the database, not above it.
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: hasDatabase ? [] : ['**/campaign/__tests__/**'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
