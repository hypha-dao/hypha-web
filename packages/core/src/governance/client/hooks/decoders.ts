import { decodeFunctionData, erc20Abi } from 'viem';
import {
  regularTokenFactoryAbi,
  ownershipTokenFactoryAbi,
  decayingTokenFactoryAbi,
  daoSpaceFactoryImplementationAbi,
  decayingSpaceTokenAbi,
  tokenBalanceJoinImplementationAbi,
  tokenVotingPowerImplementationAbi,
  voteDecayTokenVotingPowerImplementationAbi,
  hyphaTokenAbi,
  votingPowerDelegationImplementationAbi,
  daoProposalsImplementationAbi,
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
                isVotingToken: decoded.args[5],
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
                isVotingToken: decoded.args[4],
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
                isVotingToken: decoded.args[5],
                decayPercentage: decoded.args[6],
                decayInterval: decoded.args[7],
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
