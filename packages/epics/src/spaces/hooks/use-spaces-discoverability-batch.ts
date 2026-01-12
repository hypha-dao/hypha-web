'use client';

import { Space } from '@hypha-platform/core/client';
import { useUserSpaceState } from './use-user-space-state';
import { shouldShowSpace } from './use-filter-spaces-by-discoverability';
import { TransparencyLevel } from '../components/transparency-level';
import { UserSpaceState } from './use-user-space-state';
import { useMemo } from 'react';
import useSWR from 'swr';
import { publicClient, getSpaceVisibility } from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import { useMemberWeb3SpaceIds } from './use-member-web3-space-ids';

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

function useGeneralUserState(): UserSpaceState {
  const { isAuthenticated } = useAuthentication();
  return useMemo(() => {
    if (!isAuthenticated) {
      return UserSpaceState.NOT_LOGGED_IN;
    }
    return UserSpaceState.LOGGED_IN;
  }, [isAuthenticated]);
}

export function useFilterSpacesListWithDiscoverability({
  spaces,
  useGeneralState = false,
}: {
  spaces: Space[];
  useGeneralState?: boolean;
}): {
  filteredSpaces: Space[];
  isLoading: boolean;
} {
  const generalUserState = useGeneralUserState();
  const { userState: spaceSpecificUserState, isLoading: isUserStateLoading } =
    useUserSpaceState({
      spaceSlug: useGeneralState ? undefined : spaces[0]?.slug,
      space: useGeneralState ? undefined : spaces[0],
    });

  const userState = useGeneralState ? generalUserState : spaceSpecificUserState;

  const { discoverabilityMap, isLoading: isDiscoverabilityLoading } =
    useSpacesDiscoverabilityBatch({ spaces });

  const { user } = useAuthentication();
  const { web3SpaceIds: userMemberSpaceIds, isLoading: isMemberSpacesLoading } =
    useMemberWeb3SpaceIds({
      personAddress: user?.wallet?.address,
    });

  const userMemberSpaceIdsSet = useMemo(() => {
    if (!userMemberSpaceIds) return new Set<number>();
    return new Set(
      userMemberSpaceIds.map((id) => Number(id)).filter((id) => !isNaN(id)),
    );
  }, [userMemberSpaceIds]);

  const filteredSpaces = useMemo(() => {
    const parentSpaceIdsMap = new Map<number, number>();
    spaces.forEach((space) => {
      if (space.web3SpaceId && space.parentId) {
        const parentSpace = spaces.find((s) => s.id === space.parentId);
        if (parentSpace?.web3SpaceId) {
          parentSpaceIdsMap.set(space.web3SpaceId, parentSpace.web3SpaceId);
        }
      }
    });

    return spaces.filter((space) => {
      if (!space.web3SpaceId) return true;
      const discoverability = discoverabilityMap.get(space.web3SpaceId);

      if (
        useGeneralState &&
        discoverability === TransparencyLevel.ORGANISATION
      ) {
        if (userMemberSpaceIdsSet.has(space.web3SpaceId)) {
          return true;
        }
        
        const parentSpaceId = parentSpaceIdsMap.get(space.web3SpaceId);
        if (parentSpaceId && userMemberSpaceIdsSet.has(parentSpaceId)) {
          return true;
        }
      }
      
      return shouldShowSpace(space, discoverability, userState);
    });
  }, [spaces, discoverabilityMap, userState, useGeneralState, userMemberSpaceIdsSet]);

  return {
    filteredSpaces,
    isLoading: useGeneralState
      ? isDiscoverabilityLoading || isMemberSpacesLoading
      : isUserStateLoading || isDiscoverabilityLoading,
  };
}
