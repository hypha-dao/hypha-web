'use client';

import React from 'react';
import { useJwt, type Space } from '../../../client';
import useSWR from 'swr';

type UseOrganisationSpacesBySingleSlugReturn = {
  spaces?: Space[];
  isLoading: boolean;
};

/** Stable fallback. `data ?? []` was a new array each render and retriggered the diagram. */
const EMPTY_SPACES: Space[] = [];

export const useOrganisationSpacesBySingleSlug = (
  spaceSlug: string,
): UseOrganisationSpacesBySingleSlugReturn => {
  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}/organisation`,
    [spaceSlug],
  );

  const { jwt } = useJwt();

  const { data: spaces, isLoading } = useSWR(
    spaceSlug && jwt ? [endpoint, jwt] : null,
    async ([url, token]) => {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(
          `GET ${url} failed: ${res.status} ${res.statusText} ${text}`,
        );
      }
      return res.json();
    },
  );
  return {
    spaces: spaces ?? EMPTY_SPACES,
    isLoading,
  };
};
