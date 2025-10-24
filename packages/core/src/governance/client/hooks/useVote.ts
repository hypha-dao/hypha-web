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

  const handleCheckProposalExpiration = async () => {
    try {
      await voting.handleCheckProposalExpiration();
    } catch (error) {
      console.error('Error in check proposal expiration:', error);
      throw error;
    }
  };

  return {
    ...voting,
    handleCheckProposalExpiration,
    isDeletingToken,
    isUpdatingToken,
  };
};
