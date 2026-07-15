import type { Person } from '../../people/types';
import { BankOnboardingError } from './errors';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Individual-owner counterpart to `requireSpaceTreasuryAddress`. Returns the
 * member's own wallet address (`people.address`) as the Bridge Virtual Account
 * destination — sibling resolver, does not touch the space-side resolver chain.
 */
export async function requirePersonWalletAddress(
  person: Pick<Person, 'address'>,
): Promise<`0x${string}`> {
  const address = person.address;
  if (
    !address ||
    !/^0x[a-fA-F0-9]{40}$/.test(address) ||
    address.toLowerCase() === ZERO_ADDRESS
  ) {
    throw new BankOnboardingError(
      'You must have a wallet address on your profile before bank accounts can be enabled.',
      422,
    );
  }
  return address as `0x${string}`;
}
