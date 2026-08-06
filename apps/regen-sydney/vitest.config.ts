import { defineConfig } from 'vitest/config';

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
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
