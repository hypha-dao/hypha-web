import { defineUnitConfig } from '@hypha-platform/config-vitest';

export default defineUnitConfig({
  test: {
    fileParallelism: false,
    testTimeout: 30000,
  },
});
