import { base } from '@wagmi/core/chains';
// import { hardhat as HHC } from '@wagmi/core/chains';

import { defineConfig } from '@wagmi/cli';
import { hardhat } from '@wagmi/cli/plugins';

export default defineConfig({
  out: 'src/evm/generated.ts',
  contracts: [],
  plugins: [
    hardhat({
      project: '../storage-evm/',
      include: ['DAOSpaceFactoryImplementation.sol/**'],
      deployments: {
        DAOSpaceFactoryImplementation: {
          [base.id]: '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9',
        },
      },
    }),
  ],
});
