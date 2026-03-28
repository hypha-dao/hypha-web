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
    async ([documentSlug]) => {
      const response = await fetch(`/api/v1/documents/${documentSlug}/voters`);
      if (!response.ok) {
        // Proposal may be temporarily unavailable right after mutations.
        return [] as Voter[];
      }
      const payload = (await response.json()) as { voters?: Voter[] };
      return payload.voters ?? [];
    },
    {
      refreshInterval: 10000,
    },
  );

  return { voters: data, isLoading, error, mutate };
};
