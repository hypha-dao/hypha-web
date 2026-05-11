'use client';

import useSWR from 'swr';
// TODO: #594 declare UI interface separately
import { Space, useJwt } from '@hypha-platform/core/client';

type UseAllSpacesReturn = {
  spaces: Space[];
  isLoading: boolean;
  error?: Error;
};

export const useAllSpaces = (): UseAllSpacesReturn => {
  const endpoint = '/api/v1/spaces?parentOnly=false';

  const { jwt } = useJwt();

  const {
    data: spaces,
    isLoading,
    error,
  } = useSWR<Space[], Error>([endpoint, jwt], ([endpoint]) =>
    fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    }).then(async (res) => {
      if (!res.ok) {
        throw new Error('Failed to fetch spaces');
      }

      return res.json();
    }),
  );

  return { spaces: spaces ?? [], isLoading, error };
};
