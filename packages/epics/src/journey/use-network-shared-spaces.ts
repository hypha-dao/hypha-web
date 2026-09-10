'use client';

import { useMemo } from 'react';
import { Space } from '@hypha-platform/core/client';
import { useSpacesDiscoverabilityBatch } from '../spaces/hooks/use-spaces-discoverability-batch';
import {
  isNetworkSharedDiscoverability,
  selectNetworkPulseCandidates,
} from './network-pulse';

export function useNetworkSharedSpaces(spaces: Space[]) {
  const candidates = useMemo(
    () => selectNetworkPulseCandidates(spaces),
    [spaces],
  );
  const { discoverabilityMap, isLoading } = useSpacesDiscoverabilityBatch({
    spaces: candidates,
  });
  const sharedSpaces = useMemo(
    () =>
      candidates.filter((space) => {
        if (space.web3SpaceId == null) return false;
        return isNetworkSharedDiscoverability(
          discoverabilityMap.get(space.web3SpaceId),
        );
      }),
    [candidates, discoverabilityMap],
  );

  return { sharedSpaces, isLoading };
}
