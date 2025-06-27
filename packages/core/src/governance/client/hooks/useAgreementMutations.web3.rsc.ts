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

import { schemaCreateProposalWeb3 } from '@core/governance/validation';
import { publicClient } from '@core/common/web3/public-client';

import {
  agreementsImplementationAbi,
  agreementsImplementationAddress,
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@core/generated';

export const useAgreementMutationsWeb3Rpc = ({ proposalSlug }: { proposalSlug?: string | null }) => {
  const { client } = useSmartWallets();

  const {
    trigger: createAgreementMutation,
    reset: resetCreateAgreementMutation,
    isMutating: isCreatingAgreement,
    data: createAgreementHash,
    error: errorCreateAgreement,
  } = useSWRMutation(
    client ? ['smart-wallet', 'createProposal', proposalSlug] : null,
    async ([, _key], { arg }: { arg: { spaceId: number } }) => {
      if (!client) {
        throw new Error('Smart wallet not connected');
      }

      const proposalCounter = await publicClient.readContract({
        address: daoProposalsImplementationAddress[8453],
        abi: daoProposalsImplementationAbi,
        functionName: 'proposalCounter',
      });

      const acceptAgreementTx = {
        target: agreementsImplementationAddress[8453],
        value: 0,
        data: encodeFunctionData({
          abi: agreementsImplementationAbi,
          functionName: 'acceptAgreement',
          args: [BigInt(arg.spaceId), proposalCounter + 1n],
        }),
      };

      const input = {
        spaceId: arg.spaceId,
        duration: 86400,
        transactions: [acceptAgreementTx],
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
