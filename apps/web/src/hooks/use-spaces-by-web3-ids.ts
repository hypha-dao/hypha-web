'use client';

import React from 'react';
import useSWR from 'swr';
// TODO: #594 declare UI interface separately
import { Space, useJwt } from '@hypha-platform/core/client';

type UseSpacesByWeb3IdsReturn = {
  spaces: Space[];
  error?: unknown;
  isLoading: boolean;
};

export const useSpacesByWeb3Ids = (
  web3SpaceIds: readonly bigint[],
): UseSpacesByWeb3IdsReturn => {
  const { jwt } = useJwt();

  const endpoint = React.useMemo(
    () =>
      web3SpaceIds.length > 0
        ? `/api/v1/spaces?web3SpaceIds=${web3SpaceIds.join(',')}`
        : null,
    [web3SpaceIds],
  );

  const { data: spaces, isLoading } = useSWR(
    jwt && endpoint ? [endpoint, jwt] : null,
    ([endpoint]) =>
      fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json()),
  );

  if (spaces && 'error' in spaces) {
    return { spaces: [], error: spaces, isLoading };
  }

  return { spaces: spaces || [], isLoading };
};
