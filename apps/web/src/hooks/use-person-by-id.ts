'use client';

import React from 'react';
import useSWR from 'swr';
import { useJwt } from './use-jwt';

export const usePersonById = (personId: number) => {
  const { jwt } = useJwt();
  const endpoint = React.useMemo(
    () => `/api/v1/people/id/${personId}`,
    [personId],
  );

  const { data: person, isLoading } = useSWR(
    jwt ? [endpoint] : null,
    ([endpoint]) =>
      fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json()),
  );
  return { person, isLoading };
};
