import { base } from '@wagmi/core/chains';
// import { hardhat as HHC } from '@wagmi/core/chains';

import { defineConfig } from '@wagmi/cli';
import { hardhat } from '@wagmi/cli/plugins';

export default defineConfig({
  out: '../core/src/generated.ts',
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
        'DecayingSpaceToken.sol/**',
        'TokenBalanceJoinImplementation.sol/**',
        'TokenVotingPowerImplementation.sol/**',
        'OwnershipTokenVotingPowerImplementation.sol/**',
        'VoteDecayTokenVotingPowerImplementation.sol/**',
        'HyphaToken.sol/**',
        'SpacePaymentTracker.sol/**',
        'VotingPowerDelegationImplementation.sol/**',
        'EnergyDistributionImplementation.sol/**',
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
        DecayingSpaceToken: {
          [base.id]: '0xc8995514f8c76b9d9a509b4fdba0d06eb732907e',
        },
        TokenBalanceJoinImplementation: {
          [base.id]: '0x41cD69A3a3715B16598415df336a8Cc533CCAF76',
        },
        TokenVotingPowerImplementation: {
          [base.id]: '0x3214DE1Eb858799Db626Bd9699e78c2E6E33D2BE',
        },
        OwnershipTokenVotingPowerImplementation: {
          [base.id]: '0x255c7b5DaC3696199fEF7A8CC6Cc87190bc36eFd',
        },
        VoteDecayTokenVotingPowerImplementation: {
          [base.id]: '0x6dB5E05B21c68550B63a7404a3B68F81c159DAee',
        },
        HyphaToken: {
          [base.id]: '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3',
        },
        SpacePaymentTracker: {
          [base.id]: '0x4B61250c8F19BA96C473c65022453E95176b0139',
        },
        VotingPowerDelegationImplementation: {
          [base.id]: '0xc87546357EeFF8653cF058Be2BA850813e39cda0',
        },
        EnergyDistributionImplementation: {
          [base.id]: '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95',
        },
      },
    }),
  ],
});
