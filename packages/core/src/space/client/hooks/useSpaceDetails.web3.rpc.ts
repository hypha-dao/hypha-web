'use client';

import { publicClient } from '@hypha-platform/core/client';
import useSWR from 'swr';
import { getSpaceDetails } from '../web3';
import React from 'react';

export const useSpaceDetailsWeb3Rpc = ({
  spaceId,
}: {
  spaceId?: number | null;
}) => {
  const isValidSpaceId =
    typeof spaceId === 'number' &&
    Number.isFinite(spaceId) &&
    Number.isInteger(spaceId) &&
    spaceId > 0;
  const { data, isLoading, error } = useSWR(
    isValidSpaceId ? [spaceId, 'spaceDetails'] : null,
    async ([spaceId]) =>
      publicClient.readContract(getSpaceDetails({ spaceId: BigInt(spaceId) })),
    { revalidateOnFocus: true },
  );

  const spaceDetails = React.useMemo(() => {
    if (data) {
      const [
        unity,
        quorum,
        votingPowerSource,
        tokenAdresses,
        members,
        exitMethod,
        joinMethod,
        createdAt,
        creator,
        executor,
      ] = data;
      return {
        unity,
        quorum,
        votingPowerSource,
        tokenAdresses,
        members,
        exitMethod,
        joinMethod,
        createdAt,
        creator,
        executor,
      };
    }
  }, [data]);
  return {
    spaceDetails,
    isLoading,
    error,
  };
};
