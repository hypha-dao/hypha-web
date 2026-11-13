'use client';

import React from 'react';
import useSWR from 'swr';
// TODO: #594 declare UI interface separately
import { Space, useJwt, fetchJson } from '@hypha-platform/core/client';

type UseSpacesByMemberSlugReturn = {
  spaces: Space[];
  isLoading: boolean;
};

export const useSpacesByMemberSlug = (
  personSlug: string,
): UseSpacesByMemberSlugReturn => {
  const { jwt } = useJwt();

  const endpoint = React.useMemo(
    () => `/api/v1/people/${personSlug}/spaces`,
    [personSlug],
  );

  const { data: spaces, isLoading } = useSWR(
    jwt ? [endpoint, jwt] : null,
    ([endpoint]) =>
      fetchJson<Space[]>(
        endpoint,
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
        },
        'spaces by member',
      ),
  );

  return { spaces: spaces || [], isLoading };
};
