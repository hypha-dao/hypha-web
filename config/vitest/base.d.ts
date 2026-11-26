import type { UserConfig } from 'vitest/config';

export declare const integrationTestPatterns: string[];
export declare function defineUnitConfig(overrides?: UserConfig): UserConfig;
export declare function defineIntegrationConfig(
  overrides?: UserConfig,
): UserConfig;
