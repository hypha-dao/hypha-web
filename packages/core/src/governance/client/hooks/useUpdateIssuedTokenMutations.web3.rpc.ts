'use client';

import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import useSWRMutation from 'swr/mutation';
import { getDuration } from '@hypha-platform/ui-utils';
import { z } from 'zod';
import {
  createProposal,
  getProposalFromLogs,
  getSpaceMinProposalDuration,
  mapToCreateProposalWeb3Input,
  publicClient,
  schemaCreateProposalWeb3,
} from '../../../client';
import useSWR from 'swr';
import {
  type UpdateIssuedTokenInput,
  buildUpdateIssuedTokenTxData,
  padUpdateIssuedTokenInputIfNoTxs,
} from './build-update-issued-token-tx';

export const useUpdateIssuedTokenMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: updateIssuedTokenMutation,
    reset: resetUpdateIssuedTokenMutation,
    isMutating: isUpdatingIssuedToken,
    error: errorUpdateIssuedTokenMutation,
    data: updateIssuedTokenHash,
  } = useSWRMutation(
    proposalSlug ? [proposalSlug, 'updateIssuedToken'] : null,
    async ([proposalSlug], { arg }: { arg: UpdateIssuedTokenInput }) => {
      if (!client) throw new Error('Smart wallet client not available');

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      const effectiveArg = padUpdateIssuedTokenInputIfNoTxs(
        arg,
        arg.name ?? '',
      );
      const txData = buildUpdateIssuedTokenTxData(effectiveArg);

      const proposal: z.infer<typeof schemaCreateProposalWeb3> = {
        spaceId: BigInt(arg.spaceId),
        duration: duration && duration > 0 ? duration : getDuration(4),
        transactions: txData,
      };
      const parsedProposal = schemaCreateProposalWeb3.parse(proposal);
      const proposalArgs = mapToCreateProposalWeb3Input(parsedProposal);
      const txHash = await client.writeContract(createProposal(proposalArgs));

      return txHash;
    },
  );

  const {
    data: updatedIssuedToken,
    isLoading: isLoadingTokenFromTx,
    error: errorWaitTokenFromTx,
  } = useSWR(
    updateIssuedTokenHash ? [updateIssuedTokenHash, 'waitFor'] : null,
    async ([hash]) => {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 300_000,
      });
      return getProposalFromLogs(receipt.logs);
    },
  );

  return {
    updateIssuedToken: updateIssuedTokenMutation,
    resetUpdateIssuedToken: resetUpdateIssuedTokenMutation,
    isUpdatingIssuedToken,
    updateIssuedTokenHash,
    errorUpdateIssuedToken: errorUpdateIssuedTokenMutation,
    updatedIssuedToken,
    isLoadingTokenFromTx,
    errorWaitTokenFromTx,
  };
};
