'use client';

import { useGetDelegate } from './useGetDelegate';
import React from 'react';
import useSWR from 'swr';
import { useJwt } from '@hypha-platform/core/client';

export const useSpaceDelegate = ({
  user,
  spaceId,
}: {
  user: `0x${string}`;
  spaceId?: number;
}) => {
  const { jwt } = useJwt();

  const {
    data: delegatorAddress,
    isLoading: isDelegatesLoading,
    error,
  } = useGetDelegate({
    user: user,
    spaceId: spaceId ? BigInt(spaceId as number) : undefined,
  });

  const endpoint = React.useMemo(
    () =>
      delegatorAddress
        ? `/api/v1/people/by-web3-address/${delegatorAddress}`
        : null,
    [delegatorAddress],
  );

  const { data: person, isLoading: isPersonLoading } = useSWR(
    spaceId && endpoint ? [endpoint] : null,
    ([endpoint]) => fetch(endpoint).then((res) => res.json()),
  );

  const isLoading = isDelegatesLoading || (endpoint ? isPersonLoading : false);

  return {
    person,
    isLoading: spaceId ? isLoading : false,
    error,
  };
};
