'use client';

import React from 'react';
import useSWR from 'swr';
import { useDebounce } from 'use-debounce';

type UseSpaceBySlugExistsReturn = {
  exists?: boolean;
  spaceId?: number;
  isLoading: boolean;
  error?: Error;
};

export const useSpaceBySlugExists = (
  spaceSlug: string,
): UseSpaceBySlugExistsReturn => {
  const [debouncedSpaceSlug] = useDebounce(spaceSlug, 500);
  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${encodeURIComponent(debouncedSpaceSlug)}/exists`,
    [debouncedSpaceSlug],
  );

  type FetchResult = { exists: boolean; spaceId: number };

  const { data, isLoading, error } = useSWR(
    debouncedSpaceSlug ? [endpoint] : null,
    async ([endpoint]) => {
      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error(`Failed to check slug existence: ${res.statusText}`);
      }
      return (await res.json()) as FetchResult;
    },
  );
  const exists = data?.exists;
  const spaceId = data?.spaceId;
  return { exists, spaceId, isLoading, error };
};
