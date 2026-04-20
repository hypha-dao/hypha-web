import { publicClient } from '../../common/web3/public-client';
import { findSpaceById } from '../../space/server/queries';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import { getSpaceDetails } from '../../space/client/web3/dao-space-factory/get-space-details';
import { getDelegatesForSpace } from '../../space/client/web3/dao-space-factory/get-delegates-for-space';
import { getDelegators } from '../../space/client/web3/dao-space-factory/get-delegators';
import { isMember as isMemberContract } from '../../space/client/web3/dao-space-factory/is-member';
import type { Person } from '../../people/types';
import { memberships } from '@hypha-platform/storage-postgres';
import { and, eq } from 'drizzle-orm';
import type { DbConfig } from '../../server';

export type CoherenceSpaceAccessOptions = DbConfig & {
  /** Neon JWT — required for checkSpaceAccess parity with roster (visibility + chain membership). */
  authToken?: string;
};

/**
 * Voting / coherence writes: DB membership row, or same access as space roster API
 * (public/network visibility + on-chain member / valid delegate).
 */
export async function personMayInteractWithCoherenceSpace(
  person: Pick<Person, 'id' | 'address'>,
  spaceId: number,
  { db, authToken }: CoherenceSpaceAccessOptions,
): Promise<boolean> {
  const [membershipRow] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.personId, person.id),
        eq(memberships.spaceId, spaceId),
      ),
    )
    .limit(1);

  if (membershipRow) {
    return true;
  }

  const space = await findSpaceById({ id: spaceId }, { db });
  if (!space) {
    return false;
  }

  const rosterAccess = await checkSpaceAccessForSpace(
    { web3SpaceId: space.web3SpaceId },
    authToken,
  );
  if (rosterAccess.hasAccess) {
    return true;
  }

  if (!space.web3SpaceId) {
    return false;
  }

  const userAddress = person.address as `0x${string}` | undefined;
  if (!userAddress) {
    return false;
  }

  try {
    const spaceIdBigInt = BigInt(space.web3SpaceId);

    const isMemberResult = await publicClient.readContract(
      isMemberContract({
        spaceId: spaceIdBigInt,
        memberAddress: userAddress,
      }),
    );

    if (isMemberResult) {
      return true;
    }

    const delegates = await publicClient.readContract(
      getDelegatesForSpace({ spaceId: spaceIdBigInt }),
    );

    const isInDelegates = delegates.some(
      (delegate) => delegate.toLowerCase() === userAddress.toLowerCase(),
    );

    if (!isInDelegates) {
      return false;
    }

    const spaceDetails = await publicClient.readContract(
      getSpaceDetails({ spaceId: spaceIdBigInt }),
    );
    const [, , , , members] = spaceDetails;

    const delegators = await publicClient.readContract(
      getDelegators({
        user: userAddress,
        spaceId: spaceIdBigInt,
      }),
    );

    const membersLower = members.map((member: string) => member?.toLowerCase());

    return delegators.some((delegator: `0x${string}`) =>
      membersLower.includes(delegator?.toLowerCase()),
    );
  } catch {
    return false;
  }
}
