import 'server-only';

import { publicClient } from '../../common/web3/public-client';
import { getSpaceVisibility } from '../client/web3/dao-space-factory/get-space-visibility';
import {
  type SpaceOnChainTransparency,
  assessSpacePrivacy,
  labelTransparencyLevel,
  SpaceTransparencyLevel,
} from '../transparency-policy';

export type { SpaceOnChainTransparency };
export { assessSpacePrivacy, labelTransparencyLevel };

export async function readSpaceOnChainTransparency(
  web3SpaceId: number,
): Promise<SpaceOnChainTransparency | null> {
  if (!Number.isFinite(web3SpaceId) || web3SpaceId <= 0) {
    return null;
  }

  try {
    const visibility = await publicClient.readContract(
      getSpaceVisibility({ spaceId: BigInt(web3SpaceId) }),
    );
    const discoverability = Number(
      'discoverability' in visibility
        ? visibility.discoverability
        : visibility[0],
    ) as SpaceTransparencyLevel;
    const access = Number(
      'access' in visibility ? visibility.access : visibility[1],
    ) as SpaceTransparencyLevel;

    if (
      discoverability < SpaceTransparencyLevel.PUBLIC ||
      discoverability > SpaceTransparencyLevel.SPACE ||
      access < SpaceTransparencyLevel.PUBLIC ||
      access > SpaceTransparencyLevel.SPACE
    ) {
      return null;
    }

    return { discoverability, access };
  } catch (error) {
    console.error('[readSpaceOnChainTransparency] Failed to read visibility', {
      web3SpaceId,
      error,
    });
    return null;
  }
}
