'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useJwt } from '@hypha-platform/core/client';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';

export function useCanUpdateSignalTasks({
  spaceSlug,
  web3SpaceId,
}: {
  spaceSlug: string;
  web3SpaceId?: number;
}): {
  canUpdateTasks: boolean;
  isLoading: boolean;
} {
  const { isAuthenticated } = useAuthentication();
  const { jwt } = useJwt();
  const { canMutate, isLoading } = useCanMutateInSpace({
    spaceSlug,
    spaceId: web3SpaceId,
  });

  const canUpdateTasks =
    isAuthenticated && Boolean(jwt) && !isLoading && canMutate;

  return { canUpdateTasks, isLoading };
}

export { UserSpaceState } from '../../spaces/hooks/use-user-space-state.web3.rpc';
