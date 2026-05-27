import { resolveSpaceExecutorAddress } from '../../space/server/resolve-space-executor-address';
import type { Space } from '../../space/types';
import { BankOnboardingError } from './errors';

export async function requireSpaceTreasuryAddress(
  space: Pick<Space, 'web3SpaceId'>,
): Promise<`0x${string}`> {
  const address = await resolveSpaceExecutorAddress(space);
  if (!address) {
    throw new BankOnboardingError(
      'This space must have an on-chain treasury address before bank accounts can be enabled.',
      422,
    );
  }
  return address;
}
