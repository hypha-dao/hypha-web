'use client';

import { Space } from '@core/client';
import React from 'react';
import useSWR from 'swr';

type UseSpaceBySlugReturn = {
  space?: Space;
  isLoading: boolean;
};

export const useSpaceBySlug = (spaceSlug: string): UseSpaceBySlugReturn => {
  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}`,
    [spaceSlug],
  );
  const { data: space, isLoading } = useSWR([endpoint], ([endpoint]) =>
    fetch(endpoint).then((res) => res.json()),
  );
  return { space, isLoading };
};
