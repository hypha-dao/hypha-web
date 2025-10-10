'use client';

import React from 'react';
import useSWR from 'swr';
import { useDebounce } from 'use-debounce';

type UseSpaceBySlugExistsReturn = {
  exists?: boolean;
  spaceId?: number;
  isLoading: boolean;
};

export const useSpaceBySlugExists = (
  spaceSlug: string,
): UseSpaceBySlugExistsReturn => {
  const [debouncedSpaceSlug] = useDebounce(spaceSlug, 500);
  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${encodeURIComponent(debouncedSpaceSlug)}/exists`,
    [debouncedSpaceSlug],
  );
  const { data, isLoading } = useSWR(
    debouncedSpaceSlug ? [endpoint] : null,
    ([endpoint]) => fetch(endpoint).then((res) => res.json()),
  );
  const exists = data?.exists ?? false;
  const spaceId = data?.spaceId ?? -1;
  return { exists, spaceId, isLoading };
};
