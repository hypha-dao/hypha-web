'use client';

import type { Space } from '@hypha-platform/core/client';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import { UserSpaceState } from '../../spaces/hooks/use-user-space-state.web3.rpc';

/**
 * Signed in, but neither a member nor a delegate of the space. Only on-chain
 * spaces are judged here: elsewhere membership lives in Postgres, which the
 * client does not read, so the server stays the authority.
 */
export function isSignalSpaceNonMember({
  space,
  isLoading,
  userState,
}: {
  space: Pick<Space, 'web3SpaceId'> | null | undefined;
  isLoading: boolean;
  userState: UserSpaceState;
}): boolean {
  return (
    space?.web3SpaceId != null &&
    !isLoading &&
    (userState === UserSpaceState.LOGGED_IN ||
      userState === UserSpaceState.LOGGED_IN_ORG)
  );
}

export function useIsSignalSpaceNonMember(
  space: Space | null | undefined,
): boolean {
  const { isLoading, userState } = useCanMutateInSpace({
    space,
    spaceSlug: space?.slug,
    spaceId: space?.web3SpaceId ?? undefined,
  });
  return isSignalSpaceNonMember({ space, isLoading, userState });
}
