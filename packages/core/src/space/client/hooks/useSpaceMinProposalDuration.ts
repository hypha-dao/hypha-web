'use client';

import { publicClient } from '@hypha-platform/core/client';
import { getSpaceMinProposalDuration } from '../web3';
import useSWR from 'swr';

export const useSpaceMinProposalDuration = ({
  spaceId,
}: {
  spaceId: bigint;
}) => {
  const {
    data: duration,
    isLoading,
    error,
  } = useSWR(
    [spaceId, 'spaceMinProposalDuration'],
    async ([spaceId]) =>
      publicClient.readContract(getSpaceMinProposalDuration({ spaceId })),
    { revalidateOnFocus: true },
  );

  return {
    duration,
    isLoading,
    error,
  };
};
