'use client';

import { Space } from '@hypha-platform/core/client';
import { useSpaceDiscoverability } from './use-space-discoverability';
import { useUserSpaceState } from './use-user-space-state';
import { shouldShowSpace } from './use-filter-spaces-by-discoverability';
import { TransparencyLevel } from '../components/transparency-level';
import { UserSpaceState } from './use-user-space-state';
import { useMemo } from 'react';
import useSWR from 'swr';
import { publicClient, getSpaceVisibility } from '@hypha-platform/core/client';

export function useSpacesDiscoverabilityBatch({
  spaces,
}: {
  spaces: Space[];
}): {
  discoverabilityMap: Map<number, TransparencyLevel | undefined>;
  isLoading: boolean;
} {
  const spaceIds = useMemo(
    () =>
      spaces.filter((s) => s.web3SpaceId).map((s) => s.web3SpaceId as number),
    [spaces],
  );

  const { data, isLoading } = useSWR(
    spaceIds.length > 0 ? ['batch-discoverability', spaceIds] : null,
    async ([_, ids]) => {
      const results = await Promise.all(
        ids.map(async (spaceId) => {
          try {
            const visibility = await publicClient.readContract(
              getSpaceVisibility({ spaceId: BigInt(spaceId) }),
            );
            const discoverabilityValue =
              'discoverability' in visibility
                ? visibility.discoverability
                : (visibility as unknown as [bigint, bigint])[0];
            return {
              spaceId,
              discoverability: Number(
                discoverabilityValue,
              ) as TransparencyLevel,
            };
          } catch (error) {
            console.error(
              `Failed to fetch discoverability for space ${spaceId}:`,
              error,
            );
            return { spaceId, discoverability: undefined };
          }
        }),
      );
      return results;
    },
    { revalidateOnFocus: true },
  );

  const discoverabilityMap = useMemo(() => {
    const map = new Map<number, TransparencyLevel | undefined>();
    if (data) {
      data.forEach(({ spaceId, discoverability }) => {
        map.set(spaceId, discoverability);
      });
    }
    return map;
  }, [data]);

  return {
    discoverabilityMap,
    isLoading,
  };
}

export function useFilterSpacesListWithDiscoverability({
  spaces,
}: {
  spaces: Space[];
}): {
  filteredSpaces: Space[];
  isLoading: boolean;
} {
  const { userState, isLoading: isUserStateLoading } = useUserSpaceState({
    spaceSlug: spaces[0]?.slug,
  });

  const { discoverabilityMap, isLoading: isDiscoverabilityLoading } =
    useSpacesDiscoverabilityBatch({ spaces });

  const filteredSpaces = useMemo(() => {
    return spaces.filter((space) => {
      if (!space.web3SpaceId) return true;
      const discoverability = discoverabilityMap.get(space.web3SpaceId);
      return shouldShowSpace(space, discoverability, userState);
    });
  }, [spaces, discoverabilityMap, userState]);

  return {
    filteredSpaces,
    isLoading: isUserStateLoading || isDiscoverabilityLoading,
  };
}
