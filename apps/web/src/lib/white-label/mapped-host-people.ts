import { isMember, publicClient } from '@hypha-platform/core/client';
import type { MappedHostScope } from './mapped-host-scope';

/**
 * Server only. People routes on a mapped host answer for members of the
 * host's own Space only, and without the contact fields.
 *
 * "Member" is the on-chain roster, the same source as the Members tab. The
 * Postgres `memberships` table is not that roster: nothing writes it in this
 * codebase and the roster only reads it for a join date.
 */
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * Whether this wallet is an on-chain member of the host's Space. Fails closed:
 * no on-chain id, no valid address or an unknown Space is "not a member". A
 * read error propagates (the route answers 500); it is never read as "member".
 */
export async function isMemberOfMappedSpace(
  scope: MappedHostScope,
  address: string | null | undefined,
): Promise<boolean> {
  if (scope.kind !== 'mapped' || scope.web3SpaceId == null) return false;
  if (!address || !ADDRESS.test(address)) return false;
  return Boolean(
    await publicClient.readContract(
      isMember({
        spaceId: BigInt(scope.web3SpaceId),
        memberAddress: address as `0x${string}`,
      }),
    ),
  );
}

/** A person as a host visitor may see it: no `email`, no `sub`. */
export function toHostPerson<T extends object>(
  person: T,
): Omit<T, 'email' | 'sub'> {
  const copy = { ...(person as Record<string, unknown>) };
  delete copy['email'];
  delete copy['sub'];
  return copy as Omit<T, 'email' | 'sub'>;
}
