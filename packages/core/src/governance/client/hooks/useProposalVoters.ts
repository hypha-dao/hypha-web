'use client';

import useSWR from 'swr';

type Voter = {
  name: string;
  avatarUrl: string;
  vote: 'yes' | 'no';
  address: `0x${string}`;
};

export const useProposalVoters = (documentSlug?: string) => {
  const { data, isLoading, error, mutate } = useSWR(
    documentSlug ? [documentSlug, 'proposalVoters'] : null,
    async ([documentSlug]) =>
      fetch(`/api/v1/documents/${documentSlug}/voters`)
        .then((res) => res.json())
        .then((data) => data.voters as Voter[]),
    {
      // The voter's own vote is reflected immediately via `mutate()` after
      // voting; this background poll only needs to pick up other members'
      // votes, so a slightly slower cadence is fine.
      refreshInterval: 15000,
    },
  );

  return { voters: data, isLoading, error, mutate };
};
