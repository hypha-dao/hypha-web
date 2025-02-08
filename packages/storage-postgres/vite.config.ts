import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/core',
  plugins: [nxViteTsPaths()],
  test: {
    setupFiles: ['./src/test-utils/setup.ts'],
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/packages/core',
      provider: 'v8',
    },
    isolate: true,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    maxWorkers: 1,
    fileParallelism: false,
  },
});
