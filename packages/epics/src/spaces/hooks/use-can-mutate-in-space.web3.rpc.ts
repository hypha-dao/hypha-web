'use client';

import { Space } from '@hypha-platform/core/client';
import {
  UserSpaceState,
  useUserSpaceState,
} from './use-user-space-state.web3.rpc';

export function useCanMutateInSpace({
  spaceId,
  spaceSlug,
  space,
}: {
  spaceId?: number;
  spaceSlug?: string;
  space?: Space | null;
}): {
  canMutate: boolean;
  isLoading: boolean;
  userState: UserSpaceState;
} {
  const { userState, isLoading } = useUserSpaceState({
    spaceId,
    spaceSlug,
    space,
  });

  return {
    canMutate: !isLoading && userState === UserSpaceState.LOGGED_IN_SPACE,
    isLoading,
    userState,
  };
}
