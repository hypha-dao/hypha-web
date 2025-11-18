'use client';

import React from 'react';
import useSWR from 'swr';
import { Space } from '@hypha-platform/core/server';

type UseDbSpacesReturn = {
  spaces: Space[];
  isLoading: boolean;
  refetchDbSpaces: () => void;
};

type UseDbSpacesProps = {
  web3SpaceIds?: number[];
  parentOnly?: boolean;
};

export const useDbSpaces = ({
  web3SpaceIds,
  parentOnly,
}: UseDbSpacesProps = {}): UseDbSpacesReturn => {
  const endpoint = React.useMemo(() => {
    const url = new URL('/api/v1/spaces', window.location.origin);
    if (web3SpaceIds && web3SpaceIds.length > 0) {
      url.searchParams.set('web3SpaceIds', web3SpaceIds.join(','));
    }
    if (parentOnly !== undefined) {
      url.searchParams.set('parentOnly', parentOnly.toString());
    }
    return url.pathname + url.search;
  }, [web3SpaceIds, parentOnly]);

  const {
    data: spaces,
    isLoading,
    mutate,
  } = useSWR([endpoint], ([endpoint]) =>
    fetch(endpoint).then((res) => {
      if (!res.ok) {
        throw new Error('Failed to fetch spaces');
      }
      return res.json();
    }),
  );

  return { spaces: spaces || [], isLoading, refetchDbSpaces: mutate };
};
