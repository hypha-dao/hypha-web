'use client';

import { publicClient } from '@core/common';
import useSWR from 'swr';
import { getSpaceDetails } from '../web3';
import React from 'react';

export const useSpaceDetailsWeb3Rpc = ({ spaceId }: { spaceId: number }) => {
  const { data, isLoading, error } = useSWR(
    [spaceId, 'spaceDetails'],
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
