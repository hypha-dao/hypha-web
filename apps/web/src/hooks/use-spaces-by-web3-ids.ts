'use client';

import React from 'react';
import useSWR from 'swr';
// TODO: #594 declare UI interface separately
import { Space, useJwt } from '@hypha-platform/core/client';

type UseSpacesByMemberSlugReturn = {
  spaces: Space[];
  isLoading: boolean;
};

export const useSpacesByWeb3Ids = (
  web3SpaceIds: readonly bigint[],
): UseSpacesByMemberSlugReturn => {
  const { jwt } = useJwt();

  const endpoint = React.useMemo(
    () => `/api/v1/spaces?web3SpaceIds=${web3SpaceIds.join(',')}`,
    [web3SpaceIds],
  );

  const { data: spaces, isLoading } = useSWR(
    jwt ? [endpoint, jwt] : null,
    ([endpoint]) =>
      fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json()),
  );

  return { spaces: spaces || [], isLoading };
};
