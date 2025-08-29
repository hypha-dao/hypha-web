'use client';

import React from 'react';
import useSWR from 'swr';
import { usePersonSlug } from './use-person-slug';

export const useMemberBySlug = (slug: string) => {
  const personSlug = usePersonSlug();
  const endpoint = React.useMemo(
    () => `/api/v1/people/${personSlug}`,
    [personSlug],
  );

  const { data: person, isLoading } = useSWR(endpoint, (endpoint) =>
    fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
      },
    }).then((res) => res.json()),
  );
  return { person, isLoading };
};
