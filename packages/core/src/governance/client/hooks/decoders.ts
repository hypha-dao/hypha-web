import { decodeFunctionData, erc20Abi } from 'viem';
import {
  regularTokenFactoryAbi,
  ownershipTokenFactoryAbi,
  decayingTokenFactoryAbi,
  daoSpaceFactoryImplementationAbi,
} from '@hypha-platform/core/generated';

/** Legacy deploy ABIs (priceInUSD, no priceCurrencyFeed) for proposals created before factory upgrade */
const regularTokenFactoryDeployLegacyAbi = [
  {
    type: 'function' as const,
    name: 'deployToken',
    inputs: [
      { name: 'spaceId', internalType: 'uint256', type: 'uint256' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'symbol', internalType: 'string', type: 'string' },
      { name: 'maxSupply', internalType: 'uint256', type: 'uint256' },
      { name: 'transferable', internalType: 'bool', type: 'bool' },
      { name: 'fixedMaxSupply', internalType: 'bool', type: 'bool' },
      { name: 'autoMinting', internalType: 'bool', type: 'bool' },
      { name: 'priceInUSD', internalType: 'uint256', type: 'uint256' },
      { name: 'useTransferWhitelist', internalType: 'bool', type: 'bool' },
      { name: 'useReceiveWhitelist', internalType: 'bool', type: 'bool' },
      {
        name: 'initialTransferWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      {
        name: 'initialReceiveWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
    ],
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable' as const,
  },
];
const ownershipTokenFactoryDeployLegacyAbi = [
  {
    type: 'function' as const,
    name: 'deployOwnershipToken',
    inputs: [
      { name: 'spaceId', internalType: 'uint256', type: 'uint256' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'symbol', internalType: 'string', type: 'string' },
      { name: 'maxSupply', internalType: 'uint256', type: 'uint256' },
      { name: 'fixedMaxSupply', internalType: 'bool', type: 'bool' },
      { name: 'autoMinting', internalType: 'bool', type: 'bool' },
      { name: 'priceInUSD', internalType: 'uint256', type: 'uint256' },
      { name: 'useTransferWhitelist', internalType: 'bool', type: 'bool' },
      { name: 'useReceiveWhitelist', internalType: 'bool', type: 'bool' },
      {
        name: 'initialTransferWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      {
        name: 'initialReceiveWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
    ],
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable' as const,
  },
];
const decayingTokenFactoryDeployLegacyAbi = [
  {
    type: 'function' as const,
    name: 'deployDecayingToken',
    inputs: [
      { name: 'spaceId', internalType: 'uint256', type: 'uint256' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'symbol', internalType: 'string', type: 'string' },
      { name: 'maxSupply', internalType: 'uint256', type: 'uint256' },
      { name: 'transferable', internalType: 'bool', type: 'bool' },
      { name: 'fixedMaxSupply', internalType: 'bool', type: 'bool' },
      { name: 'autoMinting', internalType: 'bool', type: 'bool' },
      { name: 'priceInUSD', internalType: 'uint256', type: 'uint256' },
      { name: 'useTransferWhitelist', internalType: 'bool', type: 'bool' },
      { name: 'useReceiveWhitelist', internalType: 'bool', type: 'bool' },
      {
        name: 'initialTransferWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      {
        name: 'initialReceiveWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      { name: 'decayPercentage', internalType: 'uint256', type: 'uint256' },
      { name: 'decayInterval', internalType: 'uint256', type: 'uint256' },
    ],
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable' as const,
  },
];

import {
  decayingSpaceTokenAbi,
  tokenBalanceJoinImplementationAbi,
  tokenVotingPowerImplementationAbi,
  voteDecayTokenVotingPowerImplementationAbi,
  hyphaTokenAbi,
  votingPowerDelegationImplementationAbi,
  daoProposalsImplementationAbi,
  tokenBackingVaultImplementationAbi,
} from '@hypha-platform/core/generated';

type Tx = {
  data: `0x${string}`;
  target: `0x${string}`;
  value: bigint;
};

export function decodeTransaction(tx: Tx) {
  const decoders: Array<{
    abi: any;
    handler: (decoded: any, tx: Tx) => { type: string; data: any } | null;
  }> = [
    {
      abi: erc20Abi,
      handler: (decoded, tx) =>
        decoded.functionName === 'transfer'
          ? {
              type: 'transfer',
              data: {
                recipient: decoded.args[0],
                rawAmount: decoded.args[1],
                token: tx.target,
                value: tx.value,
              },
            }
          : null,
    },
    {
      abi: regularTokenFactoryAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'regular',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                transferable: decoded.args[4],
                fixedMaxSupply: decoded.args[5],
                autoMinting: decoded.args[6],
                priceInUSD: decoded.args[7],
                priceCurrencyFeed: decoded.args[8],
                useTransferWhitelist: decoded.args[9],
                useReceiveWhitelist: decoded.args[10],
                initialTransferWhitelist: decoded.args[11],
                initialReceiveWhitelist: decoded.args[12],
              },
            }
          : null,
    },
    {
      abi: ownershipTokenFactoryAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployOwnershipToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'ownership',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                fixedMaxSupply: decoded.args[4],
                autoMinting: decoded.args[5],
                priceInUSD: decoded.args[6],
                priceCurrencyFeed: decoded.args[7],
                useTransferWhitelist: decoded.args[8],
                useReceiveWhitelist: decoded.args[9],
                initialTransferWhitelist: decoded.args[10],
                initialReceiveWhitelist: decoded.args[11],
              },
            }
          : null,
    },
    {
      abi: decayingTokenFactoryAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployDecayingToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'voice',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                transferable: decoded.args[4],
                fixedMaxSupply: decoded.args[5],
                autoMinting: decoded.args[6],
                priceInUSD: decoded.args[7],
                priceCurrencyFeed: decoded.args[8],
                useTransferWhitelist: decoded.args[9],
                useReceiveWhitelist: decoded.args[10],
                initialTransferWhitelist: decoded.args[11],
                initialReceiveWhitelist: decoded.args[12],
                decayPercentage: decoded.args[13],
                decayInterval: decoded.args[14],
              },
            }
          : null,
    },
    {
      abi: regularTokenFactoryDeployLegacyAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'regular',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                transferable: decoded.args[4],
                fixedMaxSupply: decoded.args[5],
                autoMinting: decoded.args[6],
                priceInUSD: decoded.args[7],
                useTransferWhitelist: decoded.args[8],
                useReceiveWhitelist: decoded.args[9],
                initialTransferWhitelist: decoded.args[10],
                initialReceiveWhitelist: decoded.args[11],
              },
            }
          : null,
    },
    {
      abi: ownershipTokenFactoryDeployLegacyAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployOwnershipToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'ownership',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                fixedMaxSupply: decoded.args[4],
                autoMinting: decoded.args[5],
                priceInUSD: decoded.args[6],
                useTransferWhitelist: decoded.args[7],
                useReceiveWhitelist: decoded.args[8],
                initialTransferWhitelist: decoded.args[9],
                initialReceiveWhitelist: decoded.args[10],
              },
            }
          : null,
    },
    {
      abi: decayingTokenFactoryDeployLegacyAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployDecayingToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'voice',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                transferable: decoded.args[4],
                fixedMaxSupply: decoded.args[5],
                autoMinting: decoded.args[6],
                priceInUSD: decoded.args[7],
                useTransferWhitelist: decoded.args[8],
                useReceiveWhitelist: decoded.args[9],
                initialTransferWhitelist: decoded.args[10],
                initialReceiveWhitelist: decoded.args[11],
                decayPercentage: decoded.args[12],
                decayInterval: decoded.args[13],
              },
            }
          : null,
    },
    {
      abi: daoSpaceFactoryImplementationAbi,
      handler: (decoded) =>
        decoded.functionName === 'changeVotingMethod'
          ? {
              type: 'votingMethod',
              data: {
                spaceId: decoded.args[0],
                votingPowerSource: decoded.args[1],
                unity: decoded.args[2],
                quorum: decoded.args[3],
              },
            }
          : decoded.functionName === 'changeEntryMethod'
          ? {
              type: 'entryMethod',
              data: {
                spaceId: decoded.args[0],
                joinMethod: decoded.args[1],
              },
            }
          : null,
    },
    {
      abi: decayingSpaceTokenAbi,
      handler: (decoded) =>
        decoded.functionName === 'mint'
          ? {
              type: 'mint',
              data: {
                member: decoded.args[0],
                number: decoded.args[1],
              },
            }
          : null,
    },
    {
      abi: tokenBalanceJoinImplementationAbi,
      handler: (decoded) =>
        decoded.functionName === 'setTokenRequirement'
          ? {
              type: 'tokenRequirement',
              data: {
                spaceId: decoded.args[0],
                token: decoded.args[1],
                amount: decoded.args[2],
              },
            }
          : null,
    },
    {
      abi: tokenVotingPowerImplementationAbi,
      handler: (decoded) =>
        decoded.functionName === 'setSpaceToken'
          ? {
              type: 'votingToken',
              data: {
                spaceId: decoded.args[0],
                token: decoded.args[1],
              },
            }
          : null,
    },
    {
      abi: voteDecayTokenVotingPowerImplementationAbi,
      handler: (decoded) =>
        decoded.functionName === 'setSpaceToken'
          ? {
              type: 'votingToken',
              data: {
                spaceId: decoded.args[0],
                token: decoded.args[1],
              },
            }
          : null,
    },
    {
      abi: hyphaTokenAbi,
      handler: (decoded) =>
        decoded.functionName === 'investInHypha'
          ? {
              type: 'investInHypha',
              data: {
                amount: decoded.args[0],
              },
            }
          : null,
    },
    {
      abi: hyphaTokenAbi,
      handler: (decoded) =>
        decoded.functionName === 'payForSpaces'
          ? {
              type: 'payForSpaces',
              data: {
                spaceIds: decoded.args[0],
                paymentAmounts: decoded.args[1],
              },
            }
          : null,
    },
    {
      abi: hyphaTokenAbi,
      handler: (decoded) =>
        decoded.functionName === 'payInHypha'
          ? {
              type: 'payInHypha',
              data: {
                spaceIds: decoded.args[0],
                paymentAmounts: decoded.args[1],
              },
            }
          : null,
    },
    {
      abi: votingPowerDelegationImplementationAbi,
      handler: (decoded) => {
        return decoded.functionName === 'delegate'
          ? {
              type: 'delegate',
              data: {
                member: decoded.args[0],
                space: decoded.args[1],
              },
            }
          : null;
      },
    },
    {
      abi: daoSpaceFactoryImplementationAbi,
      handler: (decoded) => {
        return decoded.functionName === 'joinSpace'
          ? {
              type: 'joinSpace',
              data: {
                spaceId: decoded.args[0],
              },
            }
          : decoded.functionName === 'setSpaceDiscoverability'
          ? {
              type: 'setSpaceDiscoverability',
              data: {
                spaceId: decoded.args[0],
                discoverability: decoded.args[1],
              },
            }
          : decoded.functionName === 'setSpaceAccess'
          ? {
              type: 'setSpaceAccess',
              data: {
                spaceId: decoded.args[0],
                access: decoded.args[1],
              },
            }
          : null;
      },
    },
    {
      abi: daoProposalsImplementationAbi,
      handler: (decoded) => {
        return decoded.functionName === 'setMinimumProposalDuration'
          ? {
              type: 'setMinimumProposalDuration',
              data: {
                spaceId: decoded.args[0],
                duration: decoded.args[1],
              },
            }
          : null;
      },
    },
    {
      abi: daoSpaceFactoryImplementationAbi,
      handler: (decoded) =>
        decoded.functionName === 'removeMember'
          ? {
              type: 'membershipExit',
              data: {
                space: decoded.args[0],
                member: decoded.args[1],
              },
            }
          : null,
    },
    {
      abi: tokenBackingVaultImplementationAbi,
      handler: (decoded) => {
        const spaceId = decoded.args[0];
        const spaceToken = decoded.args[1] as string;
        const base = { spaceId, spaceToken };
        switch (decoded.functionName) {
          case 'addBackingToken':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'addBackingToken',
                ...base,
                backingTokens: decoded.args[2] as `0x${string}`[],
                priceFeeds: decoded.args[3] as `0x${string}`[],
                tokenDecimals: decoded.args[4] as number[],
                fundingAmounts: decoded.args[5] as bigint[],
                minimumBackingBps: decoded.args[6] as bigint,
                redemptionPrice: decoded.args[7] as bigint,
                redemptionPriceCurrencyFeed: decoded.args[8] as `0x${string}`,
                maxRedemptionBps: decoded.args[9] as bigint,
                maxRedemptionPeriodDays: decoded.args[10] as bigint,
              },
            };
          case 'setRedeemEnabled':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'setRedeemEnabled',
                ...base,
                enabled: decoded.args[2] as boolean,
              },
            };
          case 'setRedemptionStartDate':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'setRedemptionStartDate',
                ...base,
                startDate: decoded.args[2] as bigint,
              },
            };
          case 'setRedemptionPrice':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'setRedemptionPrice',
                ...base,
                price: decoded.args[2] as bigint,
                currencyFeed: decoded.args[3] as `0x${string}`,
              },
            };
          case 'setMaxRedemptionPercentage':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'setMaxRedemptionPercentage',
                ...base,
                maxRedemptionBps: decoded.args[2] as bigint,
                periodDays: decoded.args[3] as bigint,
              },
            };
          case 'setMinimumBacking':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'setMinimumBacking',
                ...base,
                minimumBackingBps: decoded.args[2] as bigint,
              },
            };
          case 'withdrawBacking':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'withdrawBacking',
                ...base,
                backingToken: decoded.args[2] as `0x${string}`,
                amount: decoded.args[3] as bigint,
              },
            };
          case 'setWhitelistEnabled':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'setWhitelistEnabled',
                ...base,
                enabled: decoded.args[2] as boolean,
              },
            };
          case 'addToWhitelist':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'addToWhitelist',
                ...base,
                accounts: decoded.args[2] as `0x${string}`[],
              },
            };
          default:
            return null;
        }
      },
    },
  ];

  for (const { abi, handler } of decoders) {
    try {
      const decoded = decodeFunctionData({
        abi,
        data: tx.data,
      });
      const result = handler(decoded, tx);
      if (result) return result;
    } catch (_) {
      continue;
    }
  }

  return null;
}
