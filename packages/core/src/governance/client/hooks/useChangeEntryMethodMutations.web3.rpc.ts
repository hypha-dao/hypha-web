'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { z } from 'zod';
import { encodeFunctionData, zeroAddress } from 'viem';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';

import {
  createProposal,
  getProposalFromLogs,
  mapToCreateProposalWeb3Input,
} from '../web3';
import { schemaCreateProposalWeb3 } from '@core/governance/validation';
import { publicClient } from '@core/common/web3/public-client';

import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
  tokenBalanceJoinImplementationAbi,
  tokenBalanceJoinImplementationAddress,
} from '@core/generated';

import { Address, EntryMethodType, TokenBase } from '@core/governance/types';
import { transactionSchema } from '@core/governance/validation';

type TxData = z.infer<typeof transactionSchema>;

const chainId = 8453;

function changeEntryMethodTx(spaceId: number, joinMethod: number): TxData {
  return {
    target: daoSpaceFactoryImplementationAddress[chainId],
    value: 0,
    data: encodeFunctionData({
      abi: daoSpaceFactoryImplementationAbi,
      functionName: 'changeEntryMethod',
      args: [BigInt(spaceId), BigInt(joinMethod)],
    }),
  };
}

function setTokenRequirementTx(
  spaceId: number,
  token: Address,
  amount: number,
): TxData {
  return {
    target: tokenBalanceJoinImplementationAddress[chainId],
    value: 0,
    data: encodeFunctionData({
      abi: tokenBalanceJoinImplementationAbi,
      functionName: 'setTokenRequirement',
      args: [BigInt(spaceId), token, BigInt(amount)],
    }),
  };
}

interface ChangeEntryMethodArgs {
  spaceId: number;
  joinMethod: number;
  tokenBase?: TokenBase;
}

export const useChangeEntryMethodMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: createChangeEntryMethod,
    reset: resetChangeEntryMethod,
    isMutating: isChangeEntryMethodMutating,
    data: createProposalHash,
    error: errorChangeEntryMethod,
  } = useSWRMutation(
    `changeEntryMethod-${proposalSlug}`,
    async (_, { arg }: { arg: ChangeEntryMethodArgs }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const transactions: Array<TxData> = [];

      switch (arg.joinMethod) {
        case EntryMethodType.OPEN_ACCESS:
        case EntryMethodType.INVITE_ONLY:
          transactions.push(changeEntryMethodTx(arg.spaceId, arg.joinMethod));
          break;
        case EntryMethodType.TOKEN_BASED:
          transactions.push(
            setTokenRequirementTx(
              arg.spaceId,
              arg.tokenBase?.token ?? zeroAddress,
              arg.tokenBase?.amount ?? 0,
            ),
            changeEntryMethodTx(arg.spaceId, arg.joinMethod),
          );
          break;
        default:
          throw new Error('Unsupported join method type');
      }

      const input = {
        spaceId: arg.spaceId,
        duration: 86400,
        transactions,
      };

      const parsedInput = schemaCreateProposalWeb3.parse(input);
      const args = mapToCreateProposalWeb3Input(parsedInput);

      const txHash = await client.writeContract(createProposal(args));
      return txHash;
    },
  );

  const {
    data: changeEntryMethodData,
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
    createChangeEntryMethod,
    resetChangeEntryMethod,
    isChangeEntryMethodMutating,
    isLoadingProposalFromTx,
    errorChangeEntryMethod,
    errorWaitProposalFromTx,
    createProposalHash,
    changeEntryMethodData,
  };
};
