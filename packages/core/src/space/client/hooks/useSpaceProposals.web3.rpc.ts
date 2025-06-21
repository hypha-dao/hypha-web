'use client';

import useSWR from 'swr';
import { getSpaceProposals } from '../web3';
import React from 'react';

export const useSpaceProposalsWeb3Rpc = ({ spaceId }: { spaceId: number }) => {
  const { data, isLoading, error } = useSWR(
    [spaceId, 'spaceProposals'],
    async ([spaceId]) => getSpaceProposals({ spaceId: BigInt(spaceId) }),
    { revalidateOnFocus: true },
  );

  const spaceProposalsIds = React.useMemo(() => {
    return data;
  }, [data]);

  return {
    spaceProposalsIds,
    isLoading,
    error,
  };
};
