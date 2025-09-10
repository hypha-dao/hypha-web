'use client';

import React from 'react';
import { useJwt, type Space } from '../../../client';
import useSWR from 'swr';

type UseOrganisationSpacesBySingleSlugReturn = {
  spaces?: Space[];
  isLoading: boolean;
};

export const useOrganisationSpacesBySingleSlug = (
  spaceSlug: string,
): UseOrganisationSpacesBySingleSlugReturn => {
  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}/organisation`,
    [spaceSlug],
  );

  const { jwt } = useJwt();

  const { data: spaces, isLoading } = useSWR(
    spaceSlug ? [endpoint] : null,
    ([endpoint]) =>
      fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json()),
  );
  return {
    spaces: spaces ?? [],
    isLoading,
  };
};
