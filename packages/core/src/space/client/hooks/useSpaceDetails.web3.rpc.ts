'use client';

import useSWR from 'swr';
import { getSpaceDetails } from '../web3';

export const useSpaceDetailsWeb3Rpc = ({ spaceId }: { spaceId: number }) => {
  const { data, isLoading, error } = useSWR(
    [spaceId, 'spaceDetails'],
    async ([spaceId]) => getSpaceDetails({ spaceId: BigInt(spaceId) }),
    { revalidateOnFocus: true },
  );

  return {
    spaceDetails: data,
    isLoading,
    error,
  };
};
