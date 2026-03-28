'use client';

import { publicClient } from '@hypha-platform/core/client';
import useSWR from 'swr';
import { getWithdrawnProposalsBySpace } from '../web3/dao-space-factory/get-withdrawn-proposals-by-space';
import React from 'react';

export const useWithdrawnProposalsWeb3Rpc = ({
  spaceId,
}: {
  spaceId: number;
}) => {
  const isValidSpaceId = Number.isFinite(spaceId) && spaceId > 0;
  const { data, isLoading, error, mutate } = useSWR(
    isValidSpaceId ? [spaceId, 'withdrawnProposals'] : null,
    async ([spaceId]) =>
      publicClient.readContract(
        getWithdrawnProposalsBySpace({ spaceId: BigInt(spaceId) }),
      ),
    { revalidateOnFocus: true, refreshInterval: 10000 },
  );

  const withdrawnProposalsIds = React.useMemo(() => {
    if (!data) return undefined;
    return data as unknown as bigint[];
  }, [data]);

  return {
    withdrawnProposalsIds,
    isLoading,
    error,
    mutateWithdrawnProposals: mutate,
  };
};
