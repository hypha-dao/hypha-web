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

  const { data, error, isLoading } = useSWR<Space[] | { error: string }, Error>(
    endpoint,
    async (url: string) => {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });
      const body = (await res.json()) as Space[] | { error: string };
      if (!res.ok) {
        const message =
          typeof body === 'object' &&
          body !== null &&
          'error' in body &&
          typeof (body as { error?: string }).error === 'string'
            ? (body as { error: string }).error
            : `Request failed (${res.status})`;
        throw new Error(message);
      }
      return body;
    },
  );

  if (error) {
    return { spaces: [], error, isLoading };
  }

  if (
    data &&
    typeof data === 'object' &&
    'error' in data &&
    !Array.isArray(data)
  ) {
    return { spaces: [], error: data, isLoading };
  }

  return { spaces: (data as Space[] | undefined) ?? [], isLoading };
};
