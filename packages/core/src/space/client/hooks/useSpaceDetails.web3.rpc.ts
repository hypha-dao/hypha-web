'use client';

import { publicClient } from '@hypha-platform/core/client';
import useSWR from 'swr';
import { getSpaceDetails } from '../web3';
import React from 'react';

function isValidSpaceIdForRpc(
  spaceId: number | null | undefined,
): spaceId is number {
  return typeof spaceId === 'number' && Number.isFinite(spaceId);
}

export const useSpaceDetailsWeb3Rpc = ({
  spaceId,
}: {
  spaceId?: number | null;
}) => {
  /** `NaN != null` is true — never pass NaN through to readContract (e.g. Number(undefined) from callers). */
  const { data, isLoading, error } = useSWR(
    isValidSpaceIdForRpc(spaceId) ? [spaceId, 'spaceDetails'] : null,
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
