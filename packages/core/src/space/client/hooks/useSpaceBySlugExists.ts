'use client';

import React from 'react';
import useSWR from 'swr';

type UseSpaceBySlugExistsReturn = {
  exists?: boolean;
  isLoading: boolean;
};

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
  const exists = data ? (data as { exists: boolean }).exists : undefined;
  return { exists, isLoading };
};
