'use client';

import { POLL } from '../../../common/poll-intervals';
import useSWR from 'swr';
import { fetchProposalVoters } from './batch-proposal-voters';

export const useProposalVoters = (documentSlug?: string) => {
  const { data, isLoading, error, mutate } = useSWR(
    documentSlug ? [documentSlug, 'proposalVoters'] : null,
    // Proposals asked for in the same moment share one request.
    ([documentSlug]) => fetchProposalVoters(documentSlug),
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
