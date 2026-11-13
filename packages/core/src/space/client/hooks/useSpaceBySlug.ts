'use client';

import { Space } from '@hypha-platform/core/client';
import React from 'react';
import useSWR from 'swr';
import { fetchJson } from '../../../common/fetch-json';

type UseSpaceBySlugReturn = {
  space?: Space;
  isLoading: boolean;
};

export const useSpaceBySlug = (spaceSlug: string): UseSpaceBySlugReturn => {
  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}`,
    [spaceSlug],
  );
  const { data: space, isLoading } = useSWR(
    spaceSlug ? endpoint : null,
    (endpoint) => fetchJson<Space>(endpoint, undefined, 'space'),
  );
  return { space, isLoading };
};
