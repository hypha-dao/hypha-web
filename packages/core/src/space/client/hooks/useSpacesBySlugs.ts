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
    return slugs.length > 0
      ? `/api/v1/spaces?slugs=${slugs.join(',')}${parentOnlyParam}`
      : null;
  }, [slugs, parentOnly]);

  const { data: spaces, isLoading } = useSWR(endpoint, (endpoint) =>
    fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
      },
    }).then((res) => res.json()),
  );

  if (spaces && 'error' in spaces) {
    return { spaces: [], error: spaces, isLoading };
  }

  return { spaces: spaces || [], isLoading };
};
