'use client';

import { useProposalVoting } from './useProposalVoting';
import { useProposalEvents } from './useProposalEvents';
import { useJoinSpaceProposalHandler } from '@hypha-platform/core/client';

export const useVote = ({
  proposalId,
  tokenSymbol,
  authToken,
}: {
  proposalId?: number | null;
  tokenSymbol?: string | null;
  authToken?: string | null;
}) => {
  const voting = useProposalVoting({ proposalId });
  const { handleJoinSpaceExecutedProposal } = useJoinSpaceProposalHandler({
    authToken,
  });

  const { isDeletingToken, isUpdatingToken } = useProposalEvents({
    proposalId,
    tokenSymbol,
    authToken,
    onProposalExecuted: async (transactionHash: string) => {
      if (proposalId) {
        await handleJoinSpaceExecutedProposal(
          Number(proposalId),
          transactionHash as `0x${string}`,
        );
      }
    },
  });

  return {
    ...voting,
    isDeletingToken,
    isUpdatingToken,
  };
};
