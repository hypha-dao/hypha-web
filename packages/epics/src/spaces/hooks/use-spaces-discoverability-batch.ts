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

const DISCOVERABILITY_CHUNK = 80;

function discoverabilityFromResult(
  visibility: unknown,
): TransparencyLevel | undefined {
  if (visibility == null) return undefined;
  const value =
    typeof visibility === 'object' &&
    visibility !== null &&
    'discoverability' in visibility
      ? (visibility as { discoverability: unknown }).discoverability
      : Array.isArray(visibility)
      ? visibility[0]
      : undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? (parsed as TransparencyLevel) : undefined;
}

/** One multicall per chunk. A separate eth_call per space stalled the network list. */
async function fetchDiscoverabilityBatch(ids: number[]) {
  const chunks: number[][] = [];
  for (let index = 0; index < ids.length; index += DISCOVERABILITY_CHUNK) {
    chunks.push(ids.slice(index, index + DISCOVERABILITY_CHUNK));
  }
  const parts = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const response = await publicClient.multicall({
          allowFailure: true,
          contracts: chunk.map((spaceId) =>
            getSpaceVisibility({ spaceId: BigInt(spaceId) }),
          ),
        });
        return response.map((result, index) => ({
          spaceId: chunk[index]!,
          discoverability:
            result.status === 'success'
              ? discoverabilityFromResult(result.result)
              : undefined,
        }));
      } catch (error) {
        console.error('Failed to fetch space discoverability', error);
        return chunk.map((spaceId) => ({
          spaceId,
          discoverability: undefined as TransparencyLevel | undefined,
        }));
      }
    }),
  );
  return parts.flat();
}

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
    ([_, ids]) => fetchDiscoverabilityBatch(ids),
    { revalidateOnFocus: false },
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

/**
 * Space-level discoverability. The network map and directory use this same
 * on-chain flag (`getSpaceVisibility` discoverability) to keep a space off
 * both surfaces, including for members.
 */
export function isNetworkPrivateDiscoverability(
  discoverability: TransparencyLevel | undefined,
): boolean {
  return discoverability === TransparencyLevel.SPACE;
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
  /** Network explore: never list Space-level discoverability (even for members). */
  excludeSpaceLevelFromNetwork = false,
}: {
  spaces: Space[];
  useGeneralState?: boolean;
  excludeSpaceLevelFromNetwork?: boolean;
}): {
  filteredSpaces: Space[];
  /**
   * Spaces from the input that `filteredSpaces` left out. On the network
   * page that is the directory and the map's source set, so this is every
   * space those surfaces omit — not only Space-level discoverability.
   */
  privateSpaces: Space[];
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
        if (isNetworkPrivateDiscoverability(discoverability)) {
          // Network is a public discovery surface: Space-level spaces belong
          // on My Spaces (and in-space navigation), not the Network list/map.
          if (excludeSpaceLevelFromNetwork) {
            return false;
          }
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
    excludeSpaceLevelFromNetwork,
    userMemberSpaceIdsSet,
  ]);

  const privateSpaces = useMemo(() => {
    const onNetworkView = new Set(filteredSpaces.map((space) => space.id));
    return spaces.filter((space) => !onNetworkView.has(space.id));
  }, [spaces, filteredSpaces]);

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
    privateSpaces,
    isLoading: useGeneralState
      ? isGeneralStateLoading
      : isUserStateLoading || isDiscoverabilityLoading,
  };
}
