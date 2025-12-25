'use client';

import { Space } from '@hypha-platform/core/client';
import { useSpaceDiscoverability } from './use-space-discoverability';
import { useUserSpaceState, UserSpaceState } from './use-user-space-state';
import { shouldShowSpace } from './use-filter-spaces-by-discoverability';
import { useMemo } from 'react';

export function useFilterSpacesList({ spaces }: { spaces: Space[] }): {
  filteredSpaces: Space[];
  isLoading: boolean;
} {
  const { userState, isLoading: isUserStateLoading } = useUserSpaceState({
    spaceSlug: spaces[0]?.slug,
  });

  const filteredSpaces = useMemo(() => {
    if (spaces.length === 0) return [];

    return spaces;
  }, [spaces]);

  return {
    filteredSpaces,
    isLoading: isUserStateLoading,
  };
}

export function filterSpacesByDiscoverability(
  spaces: Space[],
  discoverabilityMap: Map<number, number | undefined>,
  userState: UserSpaceState,
): Space[] {
  return spaces.filter((space) => {
    if (!space.web3SpaceId) return true;
    const discoverability = discoverabilityMap.get(space.web3SpaceId);
    return shouldShowSpace(space, discoverability, userState);
  });
}
