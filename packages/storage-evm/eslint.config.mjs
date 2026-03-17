import nx from '@nx/eslint-plugin';
import { config as baseConfig } from '@hypha-platform/config-eslint/base';

export default [
  {
    ignores: ['typechain-types/**'],
  },
  ...baseConfig,
  ...nx.configs['flat/react-typescript'],
];
