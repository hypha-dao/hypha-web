'use client';

import { useMe, useProposalVoters } from '@hypha-platform/core/client';

export const useMyVote = (documentSlug?: string) => {
  const { person } = useMe();
  const { voters, isLoading, error, mutate } = useProposalVoters(
    person?.address ? documentSlug : undefined,
  );

  if (!person?.address || !voters || isLoading) {
    return { myVote: null, isLoading, error, mutate };
  }

  const myVoteData = voters.find(
    (v) => v.address.toLowerCase() === person.address?.toLowerCase(),
  );

  const myVote = myVoteData ? myVoteData.vote : null;

  return { myVote, isLoading, error, mutate };
};
