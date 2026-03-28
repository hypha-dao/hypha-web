'use client';

import { publicClient } from '@hypha-platform/core/client';
import useSWR from 'swr';
import { getSpaceDetails } from '../web3';
import React from 'react';

<<<<<<< HEAD
export const useSpaceDetailsWeb3Rpc = ({
  spaceId,
}: {
  spaceId?: number | null;
}) => {
  const { data, isLoading, error } = useSWR(
    spaceId != null ? [spaceId, 'spaceDetails'] : null,
=======
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
>>>>>>> 8ae22de9c (fix(voting): guard proposal hooks against transient invalid ids)
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
