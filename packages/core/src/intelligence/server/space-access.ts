import 'server-only';

import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import type { Space } from '../../space/types';

export type IntelligenceSpaceAccessInput = {
  /** IBA space API key: skip Privy membership / transparency. */
  skipMembershipCheck?: boolean;
  authToken?: string;
};

export type IntelligenceSpaceAccessResult =
  | { access: 'ok' }
  | { access: 'denied'; message: string; space_slug: string };

export async function gateIntelligenceSpaceAccess(
  space: Pick<Space, 'id' | 'slug' | 'web3SpaceId'>,
  input: IntelligenceSpaceAccessInput,
  spaceSlug: string,
): Promise<IntelligenceSpaceAccessResult> {
  if (input.skipMembershipCheck) {
    return { access: 'ok' };
  }
  if (space.web3SpaceId == null) {
    return { access: 'ok' };
  }
  if (!canConvertToBigInt(space.web3SpaceId)) {
    return {
      access: 'denied',
      message: `Space "${space.slug}" has an invalid on-chain space id.`,
      space_slug: spaceSlug,
    };
  }
  const gate = await checkSpaceAccessForSpace(space, input.authToken);
  if (!gate.hasAccess) {
    return {
      access: 'denied',
      message: gate.message,
      space_slug: spaceSlug,
    };
  }
  return { access: 'ok' };
}
