'use client';

import { publicClient } from '@core/common';
import useSWR from 'swr';
import { getSpaceProposals } from '../web3';
import React from 'react';

export const useSpaceProposalsWeb3Rpc = ({ spaceId }: { spaceId: number }) => {
  const { data, isLoading, error } = useSWR(
    [spaceId, 'spaceProposals'],
    async ([spaceId]) =>
      publicClient.readContract(
        getSpaceProposals({ spaceId: BigInt(spaceId) }),
      ),
    { revalidateOnFocus: true },
  );

  const spaceProposalsIds = React.useMemo(() => {
    if (!data) return undefined;
    const [accepted, rejected] = data as unknown as [bigint[], bigint[]];

    return { accepted, rejected };
  }, [data]);

  return {
    spaceProposalsIds,
    isLoading,
    error,
  };
};
