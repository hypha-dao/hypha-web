import { defineConfig } from 'vitest/config';

/**
 * Package tsconfig leaves JSX as `preserve`. Esbuild otherwise emits the
 * classic runtime, which breaks component tests that import TSX from here
 * or from `@hypha-platform/ui`.
 */
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
});
