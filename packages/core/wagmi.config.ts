import { base } from '@wagmi/core/chains';
// import { hardhat as HHC } from '@wagmi/core/chains';

import { defineConfig } from '@wagmi/cli';
import { hardhat } from '@wagmi/cli/plugins';

export default defineConfig({
  out: 'src/generated.ts',
  contracts: [],
  plugins: [
    hardhat({
      project: '../storage-evm/',
      include: [
        'DAOSpaceFactoryImplementation.sol/**',
        'AgreementsImplementation.sol/**',
        'DAOProposalsImplementation.sol/**',
        'RegularTokenFactory.sol/**',
        'DecayingTokenFactory.sol/**',
        'OwnershipTokenFactory.sol/**',
      ],
      deployments: {
        DAOSpaceFactoryImplementation: {
          [base.id]: '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9',
        },
        AgreementsImplementation: {
          [base.id]: '0x83B5d4F555A68126bB302685e67767Bb7a2985F0',
        },
        DAOProposalsImplementation: {
          [base.id]: '0x001bA7a00a259Fb12d7936455e292a60FC2bef14',
        },
        RegularTokenFactory: {
          [base.id]: '0x95A33EC94de2189893884DaD63eAa19f7390144a',
        },
        DecayingTokenFactory: {
          [base.id]: '0x299f4D2327933c1f363301dbd2a28379ccD5539b',
        },
        OwnershipTokenFactory: {
          [base.id]: '0xA1eDf096B72226ae2f7BDEb12E9c9C82152BccB6',
        },
      },
    }),
  ],
});
