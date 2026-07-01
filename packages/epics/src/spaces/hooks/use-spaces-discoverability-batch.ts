'use client';

import { Space } from '@hypha-platform/core/client';
import { useUserSpaceState } from './use-user-space-state.web3.rpc';
import { shouldShowSpace } from './use-filter-spaces-by-discoverability';
import { TransparencyLevel } from '../components/transparency-level';
import { UserSpaceState } from './use-user-space-state.web3.rpc';
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

  const {
    user,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuthentication();
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
    const orgSpacesMap = new Map<number, Set<number>>();

    spaces.forEach((space) => {
      if (space.web3SpaceId && space.parentId) {
        const parentSpace = spaces.find((s) => s.id === space.parentId);
        if (parentSpace?.web3SpaceId) {
          parentSpaceIdsMap.set(space.web3SpaceId, parentSpace.web3SpaceId);
        }
      }
    });

    spaces.forEach((space) => {
      if (!space.web3SpaceId) return;

      let rootId = space.web3SpaceId;
      let currentId = space.web3SpaceId;
      const visited = new Set<number>();

      while (parentSpaceIdsMap.has(currentId) && !visited.has(currentId)) {
        visited.add(currentId);
        currentId = parentSpaceIdsMap.get(currentId)!;
        rootId = currentId;
      }

      if (!orgSpacesMap.has(rootId)) {
        orgSpacesMap.set(rootId, new Set());
      }
      orgSpacesMap.get(rootId)!.add(space.web3SpaceId);

      visited.forEach((visitedId) => {
        orgSpacesMap.get(rootId)!.add(visitedId);
      });
      orgSpacesMap.get(rootId)!.add(rootId);
    });

    return spaces.filter((space) => {
      if (!space.web3SpaceId) return false;
      const discoverability = discoverabilityMap.get(space.web3SpaceId);

      if (useGeneralState) {
        if (discoverability === TransparencyLevel.SPACE) {
          return userMemberSpaceIdsSet.has(space.web3SpaceId);
        }

        if (discoverability === TransparencyLevel.ORGANISATION) {
          if (userMemberSpaceIdsSet.has(space.web3SpaceId)) {
            return true;
          }

          let orgGroup: Set<number> | undefined;
          for (const [, spaceIds] of orgSpacesMap) {
            if (spaceIds.has(space.web3SpaceId)) {
              orgGroup = spaceIds;
              break;
            }
          }

          if (orgGroup) {
            for (const orgSpaceId of orgGroup) {
              if (userMemberSpaceIdsSet.has(orgSpaceId)) {
                return true;
              }
            }
          }

          return false;
        }
      }

      return shouldShowSpace(space, discoverability, userState);
    });
  }, [
    spaces,
    discoverabilityMap,
    userState,
    useGeneralState,
    userMemberSpaceIdsSet,
  ]);

  // For the network (general) list the filtered set depends on three async
  // inputs: on-chain discoverability, whether the viewer is logged in, and which
  // spaces they are a member of. On a hard refresh Privy isn't ready yet, so the
  // viewer looks logged-out and their member-space fetch hasn't started -
  // discoverability resolves first and the list would "settle" showing only
  // public spaces, then jump as auth + membership resolve (the 76 -> 132 -> 182
  // count climb). Treat the list as loading until Privy is ready AND, when the
  // viewer is authenticated, until their member spaces have actually resolved.
  const isGeneralStateLoading =
    isAuthLoading ||
    isDiscoverabilityLoading ||
    isMemberSpacesLoading ||
    (isAuthenticated &&
      user?.wallet?.address != null &&
      userMemberSpaceIds === undefined);

  return {
    filteredSpaces,
    isLoading: useGeneralState
      ? isGeneralStateLoading
      : isUserStateLoading || isDiscoverabilityLoading,
  };
}
