import type { StorybookConfig } from '@storybook/react-vite';

import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { mergeConfig } from 'vite';
import svgr from 'vite-plugin-svgr';

const config: StorybookConfig = {
  stories: [
    '../src/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    '../../../packages/ui/src/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    '../../../packages/epics/src/**/*.stories.@(js|jsx|ts|tsx|mdx)',
  ],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    'storybook-dark-mode',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  viteFinal: async (config) =>
    mergeConfig(config, {
      plugins: [nxViteTsPaths(), svgr()],
      define: {
        'process.env': {
          NEXT_PUBLIC_IPFS_HOST: process.env.NEXT_PUBLIC_IPFS_HOST,
          NEXT_PUBLIC_IPFS_PORT: process.env.NEXT_PUBLIC_IPFS_PORT,
          NEXT_PUBLIC_IPFS_PROTOCOL: process.env.NEXT_PUBLIC_IPFS_PROTOCOL,
          NEXT_PUBLIC_IPFS_PROJECT_ID: process.env.NEXT_PUBLIC_IPFS_PROJECT_ID,
          NEXT_PUBLIC_IPFS_PROJECT_SECRET:
            process.env.NEXT_PUBLIC_IPFS_PROJECT_SECRET,
        },
      },
    }),
};

export default config;

// To customize your Vite configuration you can use the viteFinal field.
// Check https://storybook.js.org/docs/react/builders/vite#configuration
// and https://nx.dev/recipes/storybook/custom-builder-configs
