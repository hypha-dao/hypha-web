'use client';

import React from 'react';
import useSWR from 'swr';
// TODO: #594 declare UI interface separately
import { Space } from '@hypha-platform/core/client';

type UseSpacesByWeb3IdsReturn = {
  spaces: Space[];
  error?: unknown;
  isLoading: boolean;
};

export const useSpacesByWeb3Ids = (
  web3SpaceIds: readonly bigint[],
  parentOnly?: boolean,
): UseSpacesByWeb3IdsReturn => {
  const parentOnlyParam =
    typeof parentOnly === 'undefined' ? '' : `&parentOnly=${parentOnly}`;
  const endpoint = React.useMemo(
    () =>
      web3SpaceIds.length > 0
        ? `/api/v1/spaces?web3SpaceIds=${web3SpaceIds.join(
            ',',
          )}${parentOnlyParam}`
        : null,
    [web3SpaceIds],
  );

  const { data: spaces, isLoading } = useSWR(endpoint, (endpoint) =>
    fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
      },
    }).then((res) => res.json()),
  );

  if (spaces && 'error' in spaces) {
    return { spaces: [], error: spaces, isLoading };
  }

  return { spaces: spaces || [], isLoading };
};
