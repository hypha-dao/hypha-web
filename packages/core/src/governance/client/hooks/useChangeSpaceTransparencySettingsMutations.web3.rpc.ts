'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { z } from 'zod';
import { encodeFunctionData } from 'viem';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';

import {
  createProposal,
  getProposalFromLogs,
  mapToCreateProposalWeb3Input,
} from '../web3';
import {
  publicClient,
  getSpaceMinProposalDuration,
  transactionSchema,
} from '@hypha-platform/core/client';

import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';

import { schemaCreateProposalWeb3 } from '../../validation';
import { getDuration } from '@hypha-platform/ui-utils';

type TxData = z.infer<typeof transactionSchema>;

const chainId = 8453;

interface ChangeSpaceTransparencySettingsArgs {
  spaceId: number;
  spaceDiscoverability: number;
  spaceActivityAccess: number;
}

export const useChangeSpaceTransparencySettingsMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: createChangeSpaceTransparencySettings,
    reset: resetChangeSpaceTransparencySettings,
    isMutating: isChangeSpaceTransparencySettingsMutating,
    data: createProposalHash,
    error: errorChangeSpaceTransparencySettings,
  } = useSWRMutation(
    `changeSpaceTransparencySettings-${proposalSlug}`,
    async (_, { arg }: { arg: ChangeSpaceTransparencySettingsArgs }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      const transactions: TxData[] = [];

      transactions.push({
        target: daoSpaceFactoryImplementationAddress[chainId],
        value: 0,
        data: encodeFunctionData({
          abi: daoSpaceFactoryImplementationAbi,
          functionName: 'setSpaceDiscoverability',
          args: [BigInt(arg.spaceId), BigInt(arg.spaceDiscoverability)],
        }),
      });

      transactions.push({
        target: daoSpaceFactoryImplementationAddress[chainId],
        value: 0,
        data: encodeFunctionData({
          abi: daoSpaceFactoryImplementationAbi,
          functionName: 'setSpaceAccess',
          args: [BigInt(arg.spaceId), BigInt(arg.spaceActivityAccess)],
        }),
      });

      const input = {
        spaceId: BigInt(arg.spaceId),
        duration: duration && duration > 0 ? duration : getDuration(4),
        transactions,
      };

      const parsedInput = schemaCreateProposalWeb3.parse(input);
      const args = mapToCreateProposalWeb3Input(parsedInput);

      const txHash = await client.writeContract(createProposal(args));
      return txHash;
    },
  );

  const {
    data: changeSpaceTransparencySettingsData,
    isLoading: isLoadingProposalFromTx,
    error: errorWaitProposalFromTx,
  } = useSWR(
    createProposalHash ? [createProposalHash, 'waitFor'] : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createChangeSpaceTransparencySettings,
    resetChangeSpaceTransparencySettings,
    isChangeSpaceTransparencySettingsMutating,
    isLoadingProposalFromTx,
    errorChangeSpaceTransparencySettings,
    errorWaitProposalFromTx,
    createProposalHash,
    changeSpaceTransparencySettingsData,
  };
};
