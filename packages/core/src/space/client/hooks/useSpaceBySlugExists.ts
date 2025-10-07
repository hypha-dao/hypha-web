'use client';

import React from 'react';
import useSWR from 'swr';

type UseSpaceBySlugExistsReturn = {
  exists?: boolean;
  spaceId?: number;
  isLoading: boolean;
};

interface FetchResult {
  exists: boolean;
  spaceId: number;
}

export const useSpaceBySlugExists = (
  spaceSlug: string,
): UseSpaceBySlugExistsReturn => {
  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}/exists`,
    [spaceSlug],
  );
  const { data, isLoading } = useSWR(
    spaceSlug ? [endpoint] : null,
    ([endpoint]) => fetch(endpoint).then((res) => res.json()),
  );
  const exists = data ? (data as FetchResult).exists : undefined;
  const spaceId = data ? (data as FetchResult).spaceId : undefined;
  return { exists, spaceId, isLoading };
};
