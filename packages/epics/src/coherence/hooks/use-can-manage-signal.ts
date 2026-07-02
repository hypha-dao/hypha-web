'use client';

import { useCanUpdateSignalTasks } from './use-can-update-signal-tasks';

type UseCanManageSignalArgs = {
  spaceSlug: string;
  web3SpaceId?: number;
};

/** Any space member/delegate who can interact in the panel (matches server task patch auth). */
export function useCanManageSignal({
  spaceSlug,
  web3SpaceId,
}: UseCanManageSignalArgs): boolean {
  const { canUpdateTasks } = useCanUpdateSignalTasks({
    spaceSlug,
    web3SpaceId,
  });
  return canUpdateTasks;
}
