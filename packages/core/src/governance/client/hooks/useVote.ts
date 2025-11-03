'use client';

import { useProposalVoting } from './useProposalVoting';
import { useProposalEvents } from './useProposalEvents';
import { useJoinSpaceProposalHandler } from '@hypha-platform/core/client';
import { useCallback } from 'react';

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

  const onProposalExecuted = useCallback(
    async (transactionHash: string) => {
      if (proposalId) {
        await handleJoinSpaceExecutedProposal(
          Number(proposalId),
          transactionHash as `0x${string}`,
        );
      }
    },
    [proposalId, handleJoinSpaceExecutedProposal],
  );

  const { isDeletingToken, isUpdatingToken } = useProposalEvents({
    proposalId,
    tokenSymbol,
    authToken,
    onProposalExecuted,
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
