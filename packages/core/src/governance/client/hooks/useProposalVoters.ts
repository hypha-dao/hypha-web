'use client';

import { POLL } from '../../../common/poll-intervals';
import useSWR from 'swr';
import { fetchJson } from '../../../common/fetch-json';

type Voter = {
  id?: number;
  name: string;
  avatarUrl: string;
  vote: 'yes' | 'no';
  address: `0x${string}`;
};

export const useProposalVoters = (documentSlug?: string) => {
  const { data, isLoading, error, mutate } = useSWR(
    documentSlug ? [documentSlug, 'proposalVoters'] : null,
    async ([documentSlug]) =>
      fetchJson<{ voters: Voter[] }>(
        `/api/v1/documents/${documentSlug}/voters`,
        undefined,
        'proposal voters',
      ).then((data) => data.voters),
    {
      // The voter's own vote is reflected immediately via `mutate()` after
      // voting; this background poll only needs to pick up other members'
      // votes, so a slightly slower cadence is fine.
      // While the last result is an error (e.g. a 404) SWR skips this poll and
      // its error retry takes over; polling resumes after the next success.
      refreshInterval: POLL.ACTIVE,
    },
  );

  return { voters: data, isLoading, error, mutate };
};
