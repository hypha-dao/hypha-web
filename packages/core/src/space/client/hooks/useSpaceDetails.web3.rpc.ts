'use client';

import useSWR from 'swr';
import { getSpaceDetails } from '../web3';
import React from 'react';

export const useSpaceDetailsWeb3Rpc = ({ spaceId }: { spaceId: number }) => {
  const { data, isLoading, error } = useSWR(
    [spaceId, 'spaceDetails'],
    async ([spaceId]) => getSpaceDetails({ spaceId: BigInt(spaceId) }),
    { revalidateOnFocus: true },
  );

  const spaceDetails = React.useMemo(() => {
    return data;
  }, [data]);
  return {
    spaceDetails,
    isLoading,
    error,
  };
};
