'use client';

import type { Space } from '@hypha-platform/core/client';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import { UserSpaceState } from '../../spaces/hooks/use-user-space-state.web3.rpc';

export type SignalSpaceMembership = {
  /** Signed in, but neither a member nor a delegate of the space. */
  isNonMember: boolean;
  /** On-chain membership is still resolving; voting stays gated until it settles. */
  isMembershipPending: boolean;
};

/**
 * Only on-chain spaces are judged here: elsewhere membership lives in
 * Postgres, which the client does not read, so the server stays the authority.
 */
export function signalSpaceMembership({
  space,
  isLoading,
  userState,
}: {
  space: Pick<Space, 'web3SpaceId'> | null | undefined;
  isLoading: boolean;
  userState: UserSpaceState;
}): SignalSpaceMembership {
  const isOnChain = space?.web3SpaceId != null;
  return {
    isNonMember:
      isOnChain &&
      !isLoading &&
      (userState === UserSpaceState.LOGGED_IN ||
        userState === UserSpaceState.LOGGED_IN_ORG),
    isMembershipPending: isOnChain && isLoading,
  };
}

export function useSignalSpaceMembership(
  space: Space | null | undefined,
): SignalSpaceMembership {
  const { isLoading, userState } = useCanMutateInSpace({
    space,
    spaceSlug: space?.slug,
    spaceId: space?.web3SpaceId ?? undefined,
  });
  return signalSpaceMembership({ space, isLoading, userState });
}
