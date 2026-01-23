'use client';

import { Space } from '@hypha-platform/core/client';
import { useUserSpaceState } from '../hooks/use-user-space-state';
import { shouldShowSpace } from '../hooks/use-filter-spaces-by-discoverability';
import { useMemo } from 'react';

type SpaceDiscoverabilityFilterProps = {
  spaces: Space[];
  spaceDiscoverabilityMap: Map<number, number | undefined>;
  isLoading?: boolean;
  children: (filteredSpaces: Space[], isLoading: boolean) => React.ReactNode;
};

export function SpaceDiscoverabilityFilter({
  spaces,
  spaceDiscoverabilityMap,
  isLoading: externalLoading = false,
  children,
}: SpaceDiscoverabilityFilterProps) {
  const { userState, isLoading: isUserStateLoading } = useUserSpaceState({
    spaceSlug: spaces[0]?.slug,
  });

  const filteredSpaces = useMemo(() => {
    return spaces.filter((space) => {
      if (!space.web3SpaceId) return true; // Show spaces without web3SpaceId
      const discoverability = spaceDiscoverabilityMap.get(space.web3SpaceId);
      return shouldShowSpace(space, discoverability, userState);
    });
  }, [spaces, spaceDiscoverabilityMap, userState]);

  const isLoading = isUserStateLoading || externalLoading;

  return <>{children(filteredSpaces, isLoading)}</>;
}
