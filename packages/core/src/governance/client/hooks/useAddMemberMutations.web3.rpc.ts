'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { publicClient } from '@core/common/web3/public-client';
import { getProposalFromLogs } from '../web3';
import { joinSpace } from '@core/space/client/web3/dao-space-factory/join-space';

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
    if (!spaceId) throw new Error('spaceId is required');
    if (!memberAddress) throw new Error('memberAddress is required');
    return client?.writeContract(joinSpace({ spaceId: BigInt(spaceId) }));
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
