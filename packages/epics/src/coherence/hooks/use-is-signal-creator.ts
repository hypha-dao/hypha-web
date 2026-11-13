'use client';

import { isSignalCreator, useMe } from '@hypha-platform/core/client';

/** True only for the signed-in person who raised the signal. */
export function useIsSignalCreator(creatorId?: number | null): boolean {
  const { person } = useMe();
  return isSignalCreator({ viewerPersonId: person?.id, creatorId });
}
