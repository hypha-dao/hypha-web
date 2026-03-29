'use client';

import useSWR from 'swr';
import { Person, Space } from '@hypha-platform/core/client';

type SpaceMembersResponse = {
  persons: Person[];
  spaces: Space[];
};

/**
 * Loads on-chain space members resolved to DB persons/spaces (same source as the
 * members UI). Used where `useSpaceBySlug` membership rows lack `address` and
 * `usePersonByWeb3Address` requires auth — so we still show avatar + name on
 * proposal exchange rows for viewers who can load the space.
 */
export const useSpaceMembersForPartyResolution = (spaceSlug: string) => {
  const endpoint = spaceSlug
    ? `/api/v1/spaces/${encodeURIComponent(spaceSlug)}/members`
    : null;

  const { data, isLoading } = useSWR<SpaceMembersResponse>(
    endpoint,
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) {
        return { persons: [], spaces: [] };
      }
      return res.json();
    },
    { revalidateOnFocus: false },
  );

  return {
    memberPersons: data?.persons ?? [],
    memberSpaces: data?.spaces ?? [],
    isLoading,
  };
};

export const findMemberPersonByAddress = (
  address: string | undefined,
  persons: Person[],
): Person | undefined => {
  if (!address) return undefined;
  const lower = address.toLowerCase();
  return persons.find((p) => p.address?.toLowerCase() === lower);
};

export const findMemberSpaceByAddress = (
  address: string | undefined,
  spaces: Space[],
): Space | undefined => {
  if (!address) return undefined;
  const lower = address.toLowerCase();
  return spaces.find((s) => s.address?.toLowerCase() === lower);
};
