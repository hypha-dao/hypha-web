'use client';

import { publicClient } from '@hypha-platform/core/client';
import { getSpaceMinProposalDuration } from '../web3';
import useSWR from 'swr';

export const useSpaceMinProposalDuration = ({
  spaceId,
  enabled = true,
}: {
  spaceId?: bigint | null;
  enabled?: boolean;
}) => {
  const swrKey =
    enabled && typeof spaceId === 'bigint' && spaceId > 0n
      ? ([spaceId, 'spaceMinProposalDuration'] as const)
      : null;

  const {
    data: duration,
    isLoading,
    error,
  } = useSWR(
    swrKey,
    async ([id]) =>
      publicClient.readContract(getSpaceMinProposalDuration({ spaceId: id })),
    { revalidateOnFocus: true },
  );

  return {
    duration,
    isLoading,
    error,
  };
};
