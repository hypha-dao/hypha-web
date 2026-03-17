import { config as baseConfig } from "./config/eslint/base.js";

/**
 * Root ESLint configuration for the monorepo.
 * Used when running eslint from any package (ESLint walks up to find this).
 */
export default [
  ...baseConfig,
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.config.js",
      "**/*.config.mjs",
      "**/*.config.ts",
    ],
  },
];
