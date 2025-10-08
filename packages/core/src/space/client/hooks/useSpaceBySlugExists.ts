'use client';

import React from 'react';
import useSWR from 'swr';
import { useDebounce } from 'use-debounce';

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
  const [debouncedSpaceSlug] = useDebounce(spaceSlug, 500);
  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${debouncedSpaceSlug}/exists`,
    [debouncedSpaceSlug],
  );
  const { data, isLoading } = useSWR(
    debouncedSpaceSlug ? [endpoint] : null,
    ([endpoint]) => fetch(endpoint).then((res) => res.json()),
  );
  const exists = data ? (data as FetchResult).exists : false;
  const spaceId = data ? (data as FetchResult).spaceId : -1;
  return { exists, spaceId, isLoading };
};
