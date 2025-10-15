'use client';

import React from 'react';
import useSWR from 'swr';

export const useMemberBySlug = (slug: string) => {
  const endpoint = React.useMemo(() => `/api/v1/people/${slug}`, [slug]);

  const { data: person, isLoading } = useSWR(endpoint, (endpoint) =>
    fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
      },
    }).then((res) => res.json()),
  );
  return { person, isLoading };
};
