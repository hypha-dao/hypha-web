import { canConvertToBigInt } from '@hypha-platform/ui-utils';

import { fetchSpaceDetails } from '../shared/web3/fetch-space-details';
import type { Space } from '../types';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Live treasury address from on-chain `getSpaceDetails` executor — same source as
 * the assets API and treasury UI (`useSpaceDetailsWeb3Rpc`).
 */
export async function resolveSpaceExecutorAddress(
  space: Pick<Space, 'web3SpaceId'>,
): Promise<`0x${string}` | null> {
  if (
    space.web3SpaceId == null ||
    !canConvertToBigInt(space.web3SpaceId as number)
  ) {
    return null;
  }

  const [details] = await fetchSpaceDetails({
    spaceIds: [BigInt(space.web3SpaceId as number)],
  });

  const executor = details?.executor;
  if (
    !executor ||
    !/^0x[a-fA-F0-9]{40}$/.test(executor) ||
    executor.toLowerCase() === ZERO_ADDRESS
  ) {
    return null;
  }

  return executor;
}
