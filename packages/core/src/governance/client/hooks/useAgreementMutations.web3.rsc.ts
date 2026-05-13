'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData } from 'viem';

import {
  createProposal,
  getProposalFromLogs,
  mapToCreateProposalWeb3Input,
} from '../web3';

import {
  schemaCreateProposalWeb3,
  publicClient,
  getSpaceMinProposalDuration,
} from '@hypha-platform/core/client';

import {
  agreementsImplementationAbi,
  agreementsImplementationAddress,
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@hypha-platform/core/generated';
import { getDuration } from '@hypha-platform/ui-utils';
import { getGovernanceChainId } from './governance-chain-id';

export const useAgreementMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const chainId = getGovernanceChainId();
  const { client } = useSmartWallets();

  const {
    trigger: createAgreementMutation,
    reset: resetCreateAgreementMutation,
    isMutating: isCreatingAgreement,
    data: createAgreementHash,
    error: errorCreateAgreement,
  } = useSWRMutation(
    `createProposal-${proposalSlug}`,
    async (
      _,
      {
        arg,
      }: {
        arg: {
          spaceId: number;
          /**
           * Optional additional transactions to execute when the proposal
           * passes. Useful for agreements that should also trigger an
           * on-chain action (e.g. Enable Energy Community →
           * `EnergyPPAv2Factory.deployCommunity`). Each tx is executed by
           * the space executor.
           */
          extraTransactions?: ReadonlyArray<{
            target: `0x${string}`;
            value?: bigint | number;
            data: `0x${string}`;
          }>;
        };
      },
    ) => {
      if (!client) {
        throw new Error('Smart wallet not connected');
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      const proposalCounter = await publicClient.readContract({
        address: daoProposalsImplementationAddress[chainId],
        abi: daoProposalsImplementationAbi,
        functionName: 'proposalCounter',
      });

      const acceptAgreementTx = {
        target: agreementsImplementationAddress[chainId],
        value: 0,
        data: encodeFunctionData({
          abi: agreementsImplementationAbi,
          functionName: 'acceptAgreement',
          args: [BigInt(arg.spaceId), proposalCounter + 1n],
        }),
      };

      const extraTransactions = (arg.extraTransactions ?? []).map((tx) => ({
        target: tx.target,
        value: tx.value ?? 0,
        data: tx.data,
      }));

      const input = {
        spaceId: BigInt(arg.spaceId),
        duration: duration && duration > 0 ? duration : getDuration(3),
        transactions: [acceptAgreementTx, ...extraTransactions],
      };

      const parsedInput = schemaCreateProposalWeb3.parse(input);
      const args = mapToCreateProposalWeb3Input(parsedInput);

      const txHash = await client.writeContract(createProposal(args));
      return txHash;
    },
  );

  const {
    data: createdAgreement,
    isLoading: isLoadingAgreementFromTransaction,
    error: errorWaitAgreementFromTransaction,
  } = useSWR(
    createAgreementHash ? [createAgreementHash, 'waitFor'] : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createAgreement: createAgreementMutation,
    resetCreateAgreementMutation,
    isCreatingAgreement,
    isLoadingAgreementFromTransaction,
    errorCreateAgreement,
    errorWaitAgreementFromTransaction,
    createAgreementHash,
    createdAgreement,
  };
};
