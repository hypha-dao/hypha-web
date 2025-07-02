'use client';

import useSWR from 'swr';
import { getSpaceProposals } from '../web3';

export const useSpaceProposalsWeb3Rpc = ({ spaceId }: { spaceId: number }) => {
  const { data, isLoading, error } = useSWR(
    [spaceId, 'spaceProposals'],
    async ([spaceId]) => getSpaceProposals({ spaceId: BigInt(spaceId) }),
    { revalidateOnFocus: true },
  );

  return {
    spaceProposalsIds: data,
    isLoading,
    error,
  };
};
