'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useJwt } from '@hypha-platform/core/client';
import {
  UserSpaceState,
  useUserSpaceState,
} from '../../spaces/hooks/use-user-space-state.web3.rpc';
import { canInteractInSpace } from '../../spaces/utils/transparency-access';

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
  const { userState, isLoading } = useUserSpaceState({
    spaceSlug,
    spaceId: web3SpaceId || undefined,
  });

  const canUpdateTasks =
    isAuthenticated &&
    Boolean(jwt) &&
    (isLoading || canInteractInSpace(userState));

  return { canUpdateTasks, isLoading };
}

export { UserSpaceState };
