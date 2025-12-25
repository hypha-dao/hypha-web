'use client';

import { Space } from '@hypha-platform/core/client';
import { TransparencyLevel } from '../components/transparency-level';
import { UserSpaceState } from './use-user-space-state';
import { checkDiscoverability } from '../utils/transparency-access';

export function shouldShowSpace(
  space: Space,
  discoverability: TransparencyLevel | undefined,
  userState: UserSpaceState,
): boolean {
  if (discoverability === undefined) {
    return true;
  }

  return checkDiscoverability(discoverability, userState);
}
