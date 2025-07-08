'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData } from 'viem';
import { publicClient } from '@core/common/web3/public-client';
import { getProposalFromLogs } from '../web3';

import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@core/generated';

export const useAddMemberMutationsWeb3Rpc = ({
  spaceId,
  memberAddress,
}: {
  spaceId?: number;
  memberAddress?: `0x${string}`;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: addMemberMutation,
    reset: resetAddMemberMutation,
    isMutating: isAddingMember,
    data: addMemberTxHash,
    error: errorAddMember,
  } = useSWRMutation(`addMember-${spaceId}-${memberAddress}`, async () => {
    if (!client) throw new Error('Smart wallet not connected');
    if (!spaceId || !memberAddress)
      throw new Error('spaceId and memberAddress are required');

    const addMemberTx = {
      target: daoSpaceFactoryImplementationAddress[8453],
      value: 0,
      data: encodeFunctionData({
        abi: daoSpaceFactoryImplementationAbi,
        functionName: 'addMember',
        args: [BigInt(spaceId), memberAddress],
      }),
    };

    const txHash = await client.writeContract({
      address: addMemberTx.target,
      abi: daoSpaceFactoryImplementationAbi,
      functionName: 'addMember',
      args: [BigInt(spaceId), memberAddress],
    });

    return txHash;
  });

  const {
    data: createdProposal,
    isLoading: isWaitingTxReceipt,
    error: errorWaitForReceipt,
  } = useSWR(
    addMemberTxHash ? [addMemberTxHash, 'waitForAddMemberTx'] : null,
    async ([hash]) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const proposal = getProposalFromLogs(receipt.logs);
      return proposal;
    },
  );

  return {
    addMember: addMemberMutation,
    resetAddMemberMutation,
    isAddingMember,
    addMemberTxHash,
    createdProposal,
    isWaitingTxReceipt,
    errorAddMember,
    errorWaitForReceipt,
  };
};
