'use client';

import React from 'react';
import useSWR from 'swr';
// TODO: #594 declare UI interface separately
import { Space } from '@hypha-platform/core/client';

type UseSpacesByWeb3IdsClientReturn = {
  spaces: Space[];
  error?: unknown;
  isLoading: boolean;
};

export const useSpacesByWeb3IdsClient = (
  web3SpaceIds: readonly bigint[],
  parentOnly?: boolean,
): UseSpacesByWeb3IdsClientReturn => {
  const endpoint = React.useMemo(
    () =>
      web3SpaceIds.length > 0
        ? `/api/v1/spaces?web3SpaceIds=${web3SpaceIds.join(
            ',',
          )}&parentOnly=${parentOnly}`
        : null,
    [web3SpaceIds],
  );

  const { data: spaces, isLoading } = useSWR(endpoint, (endpoint) =>
    fetch(endpoint, {
      headers: {
        Accept: 'application/json',
      },
    }).then((res) => res.json()),
  );

  if (spaces && 'error' in spaces) {
    return { spaces: [], error: spaces, isLoading };
  }

  return { spaces: spaces || [], isLoading };
};
