import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Package tsconfig leaves JSX as `preserve`. Esbuild otherwise emits the
 * classic runtime, which breaks component tests that import TSX from here
 * or from `@hypha-platform/ui`.
 */
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      'server-only': path.join(root, 'test/server-only-stub.ts'),
    },
  },
});
