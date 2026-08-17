import 'server-only';

import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import {
  checkSpaceAccessForSpace,
  type CheckSpaceAccessForRosterResult,
} from '../../space/server/check-space-access-for-roster';
import type { Space } from '../../space/types';

export async function authorizeIntelligenceSpace(
  space: Pick<Space, 'id' | 'slug' | 'web3SpaceId'>,
  authToken: string | undefined,
): Promise<CheckSpaceAccessForRosterResult> {
  if (space.web3SpaceId != null && !canConvertToBigInt(space.web3SpaceId)) {
    return {
      hasAccess: false,
      message: `Space "${space.slug}" has an invalid on-chain space id.`,
      httpStatus: 403,
    };
  }

  return checkSpaceAccessForSpace(space, authToken, {
    requireMembershipWhenOffChain: true,
  });
}
