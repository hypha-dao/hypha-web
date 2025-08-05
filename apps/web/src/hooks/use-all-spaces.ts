'use client';

import useSWR from 'swr';
// TODO: #594 declare UI interface separately
import { Space, useJwt } from '@hypha-platform/core/client';

type UseAllSpacesReturn = {
  spaces: Space[];
  isLoading: boolean;
};

export const useAllSpaces = (): UseAllSpacesReturn => {
  const endpoint = '/api/v1/spaces';

  const { jwt } = useJwt();

  const { data: spaces, isLoading } = useSWR([endpoint, jwt], ([endpoint]) =>
    fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    }).then((res) => res.json()),
  );

  return { spaces: spaces ?? [], isLoading };
};
