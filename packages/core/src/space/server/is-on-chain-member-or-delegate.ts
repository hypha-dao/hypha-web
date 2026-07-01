import { publicClient } from '../../common/web3/public-client';
import { getSpaceDetails } from '../shared/web3/get-space-details';
import { getDelegatesForSpace } from '../client/web3/dao-space-factory/get-delegates-for-space';
import { getDelegators } from '../client/web3/dao-space-factory/get-delegators';
import { isMember as isMemberConfig } from '../client/web3/dao-space-factory/is-member';

/**
 * On-chain member-or-delegate check for a single space (same contract reads as
 * `checkSpaceAccess` / `checkSpaceAccessForSpace` before org-level sibling rules).
 * Used by bank onboarding auth; roster/MCP gating keeps full transparency logic inline.
 */
export async function isOnChainMemberOrDelegate(
  web3SpaceId: number,
  userAddress: `0x${string}`,
): Promise<boolean> {
  const spaceIdBigInt = BigInt(web3SpaceId);

  const isMemberResult = await publicClient.readContract(
    isMemberConfig({
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
}
