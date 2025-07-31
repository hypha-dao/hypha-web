'use client';

import useSWR from 'swr';

type Voter = {
  name: string;
  avatarUrl: string;
  vote: 'yes' | 'no';
};

export const useProposalVoters = (documentSlug?: string) => {
  const { data, isLoading, error, mutate } = useSWR(
    documentSlug ? [documentSlug, 'proposalVoters'] : null,
    async ([documentSlug]) =>
      fetch(`/api/v1/documents/${documentSlug}/voters`)
        .then((res) => res.json())
        .then((data) => data.voters as Voter[]),
    {
      refreshInterval: 10000,
    },
  );

  return { voters: data, isLoading, error, mutate };
};
