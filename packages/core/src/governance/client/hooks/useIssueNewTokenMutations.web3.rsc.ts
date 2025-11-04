'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { encodeFunctionData } from 'viem';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';

import {
  schemaCreateProposalWeb3,
  publicClient,
  getSpaceMinProposalDuration,
} from '@hypha-platform/core/client';
import {
  getProposalFromLogs,
  mapToCreateProposalWeb3Input,
  createProposal,
} from '../web3';
import {
  regularTokenFactoryAbi,
  regularTokenFactoryAddress,
  ownershipTokenFactoryAbi,
  ownershipTokenFactoryAddress,
  decayingTokenFactoryAbi,
  decayingTokenFactoryAddress,
} from '@hypha-platform/core/generated';
import { getDuration } from '@hypha-platform/ui-utils';

interface CreateTokenArgs {
  spaceId: number;
  name: string;
  symbol: string;
  maxSupply: number;
  transferable: boolean;
  isVotingToken: boolean;
  type: 'utility' | 'credits' | 'ownership' | 'voice';
  decayPercentage?: number;
  decayInterval?: number;
}

const chainId = 8453;

export const useIssueTokenMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: createIssueToken,
    reset: resetCreateIssueToken,
    isMutating: isCreatingToken,
    data: createTokenHash,
    error: errorCreateToken,
  } = useSWRMutation(
    `createIssueToken-${proposalSlug}`,
    async (_, { arg }: { arg: CreateTokenArgs }) => {
      if (!client) throw new Error('Smart wallet client not available');

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      let txData: Array<{
        target: `0x${string}`;
        value: number;
        data: `0x${string}`;
      }> = [];

      if (['utility', 'credits'].includes(arg.type)) {
        txData = [
          {
            target: regularTokenFactoryAddress[chainId],
            value: 0,
            data: encodeFunctionData({
              abi: regularTokenFactoryAbi,
              functionName: 'deployToken',
              args: [
                BigInt(arg.spaceId),
                arg.name,
                arg.symbol,
                BigInt(arg.maxSupply) * 10n ** 18n,
                arg.transferable,
                arg.isVotingToken,
              ],
            }),
          },
        ];
      } else if (arg.type === 'ownership') {
        txData = [
          {
            target: ownershipTokenFactoryAddress[chainId],
            value: 0,
            data: encodeFunctionData({
              abi: ownershipTokenFactoryAbi,
              functionName: 'deployOwnershipToken',
              args: [
                BigInt(arg.spaceId),
                arg.name,
                arg.symbol,
                BigInt(arg.maxSupply) * 10n ** 18n,
                arg.isVotingToken,
              ],
            }),
          },
        ];
      } else if (arg.type === 'voice') {
        if (
          typeof arg.decayPercentage !== 'number' ||
          typeof arg.decayInterval !== 'number'
        ) {
          throw new Error(
            'Missing decayPercentage or decayInterval for voice token',
          );
        }

        txData = [
          {
            target: decayingTokenFactoryAddress[chainId],
            value: 0,
            data: encodeFunctionData({
              abi: decayingTokenFactoryAbi,
              functionName: 'deployDecayingToken',
              args: [
                BigInt(arg.spaceId),
                arg.name,
                arg.symbol,
                BigInt(arg.maxSupply) * 10n ** 18n,
                arg.transferable,
                arg.isVotingToken,
                BigInt(arg.decayPercentage),
                BigInt(arg.decayInterval),
              ],
            }),
          },
        ];
      }

      const parsedProposal = schemaCreateProposalWeb3.parse({
        spaceId: BigInt(arg.spaceId),
        duration: duration && duration > 0 ? duration : getDuration(4),
        transactions: txData,
      });

      const proposalArgs = mapToCreateProposalWeb3Input(parsedProposal);

      const txHash = await client.writeContract(createProposal(proposalArgs));
      return txHash;
    },
  );

  const {
    data: createdToken,
    isLoading: isLoadingTokenFromTx,
    error: errorWaitTokenFromTx,
  } = useSWR(
    createTokenHash ? [createTokenHash, 'waitFor'] : null,
    async ([hash]) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(receipt.logs);
    },
  );

  return {
    createIssueToken,
    resetCreateIssueToken,
    isCreatingToken,
    createTokenHash,
    errorCreateToken,
    createdToken,
    isLoadingTokenFromTx,
    errorWaitTokenFromTx,
  };
};
