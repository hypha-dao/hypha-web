'use client';

import React from 'react';
import useSWR from 'swr';
// TODO: #594 declare UI interface separately
import { Space } from '@hypha-platform/core/client';
import { fetchJson } from '../../../common/fetch-json';

type UseSpacesByWeb3IdsReturn = {
  spaces: Space[];
  error?: unknown;
  isLoading: boolean;
};

export const useSpacesByWeb3Ids = (
  web3SpaceIds: readonly bigint[],
  parentOnly?: boolean,
): UseSpacesByWeb3IdsReturn => {
  const endpoint = React.useMemo(() => {
    const parentOnlyParam =
      typeof parentOnly === 'undefined' ? '' : `&parentOnly=${parentOnly}`;
    return web3SpaceIds.length > 0
      ? `/api/v1/spaces?web3SpaceIds=${web3SpaceIds.join(
          ',',
        )}${parentOnlyParam}`
      : null;
  }, [web3SpaceIds, parentOnly]);

  const {
    data: spaces,
    isLoading,
    error,
  } = useSWR<Space[]>(endpoint, (endpoint: string) =>
    fetchJson<Space[]>(
      endpoint,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
      'spaces',
    ),
  );

  if (error) {
    // `error` is an `Error` carrying the HTTP `status`.
    return { spaces: [], error, isLoading };
  }

  return { spaces: spaces || [], isLoading };
};
