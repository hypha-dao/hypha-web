'use client';

import React from 'react';
import useSWR from 'swr';
import { fetchJson } from '@hypha-platform/core/client';

export const useMemberBySlug = (slug: string) => {
  const endpoint = React.useMemo(
    () => `/api/v1/people/${encodeURIComponent(slug)}`,
    [slug],
  );

  const { data: person, isLoading } = useSWR(endpoint, (endpoint) =>
    fetchJson(
      endpoint,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
      'person',
    ),
  );
  return { person, isLoading };
};
