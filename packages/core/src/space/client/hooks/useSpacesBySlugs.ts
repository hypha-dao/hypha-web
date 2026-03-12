'use client';

import React from 'react';
import useSWR from 'swr';
// TODO: #594 declare UI interface separately
import { Space } from '@hypha-platform/core/client';

type UseSpacesBySlugsReturn = {
  spaces: Space[];
  error?: unknown;
  isLoading: boolean;
};

export const useSpacesBySlugs = (
  slugs: readonly string[],
  parentOnly?: boolean,
): UseSpacesBySlugsReturn => {
  const endpoint = React.useMemo(() => {
    const parentOnlyParam =
      typeof parentOnly === 'undefined' ? '' : `&parentOnly=${parentOnly}`;
    const encodedSlugs = slugs.map(encodeURIComponent).join(',');
    return slugs.length > 0
      ? `/api/v1/spaces?slugs=${encodedSlugs}${parentOnlyParam}`
      : null;
  }, [slugs, parentOnly]);

  const {
    data: spaces,
    error: swrError,
    isLoading,
  } = useSWR(endpoint, (endpoint) =>
    fetch(endpoint, {
      headers: {
        Accept: 'application/json',
      },
    }).then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch spaces: ${res.status}`);
      }
      return res.json();
    }),
  );

  if (swrError) {
    return { spaces: [], error: swrError, isLoading };
  }

  if (spaces && 'error' in spaces) {
    return { spaces: [], error: spaces.error, isLoading };
  }

  return { spaces: spaces || [], isLoading };
};
