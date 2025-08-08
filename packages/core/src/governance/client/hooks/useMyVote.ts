'use client';

import { useMe, useProposalVoters } from '@hypha-platform/core/client';

export const useMyVote = (documentSlug?: string) => {
  const { person } = useMe();
  const { voters, isLoading, error, mutate } = useProposalVoters(documentSlug);

  if (!person?.address || !voters || isLoading) {
    return { myVote: null, isLoading, error, mutate };
  }

  const myVoteData = voters.find((voter) => voter.address === person.address);

  const myVote = myVoteData ? myVoteData.vote : null;

  return { myVote, isLoading, error, mutate };
};
