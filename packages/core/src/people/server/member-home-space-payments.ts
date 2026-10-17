import {
  spacePaymentTrackerAbi,
  spacePaymentTrackerAddress,
} from '../../generated';
import { web3Client } from '../../common/server';
import {
  memberHomeSpacesAboutToExpire,
  type MemberExpiringSpace,
  type MemberSpacePaymentSnapshot,
} from '../member-home-activation';
import type { MemberSpaceRow } from '../member-intelligence';

const PAYMENT_CHAIN_ID = 8453 as const;
const SPACE_LIMIT = 12;

function daysLeftFromExpiry(expiryTime: bigint) {
  const expiryMs = Number(expiryTime) * 1000;
  if (!Number.isFinite(expiryMs)) return 0;
  return Math.ceil((expiryMs - Date.now()) / (1000 * 60 * 60 * 24));
}

/** Payment state for the member's spaces. A failed read leaves that space out. */
export async function loadMemberSpacesAboutToExpire(
  spaces: readonly MemberSpaceRow[],
): Promise<MemberExpiringSpace[]> {
  const tracker = spacePaymentTrackerAddress[PAYMENT_CHAIN_ID];
  const tracked = spaces
    .flatMap((space) => {
      const web3SpaceId = space.web3SpaceId;
      if (
        typeof web3SpaceId !== 'number' ||
        !Number.isInteger(web3SpaceId) ||
        web3SpaceId <= 0
      ) {
        return [];
      }
      return [{ slug: space.slug, title: space.title, web3SpaceId }];
    })
    .slice(0, SPACE_LIMIT);
  if (!tracker || tracked.length === 0) return [];

  const results = await web3Client.multicall({
    allowFailure: true,
    contracts: tracked.flatMap((space) => {
      const args = [BigInt(space.web3SpaceId)] as const;
      return [
        {
          address: tracker,
          abi: spacePaymentTrackerAbi,
          functionName: 'hasSpacePaid' as const,
          args,
        },
        {
          address: tracker,
          abi: spacePaymentTrackerAbi,
          functionName: 'spacePayments' as const,
          args,
        },
      ];
    }),
  });

  const snapshots: MemberSpacePaymentSnapshot[] = [];
  for (let index = 0; index < tracked.length; index += 1) {
    const space = tracked[index];
    const paid = results[index * 2];
    const payment = results[index * 2 + 1];
    if (!space || paid?.status !== 'success' || payment?.status !== 'success') {
      continue;
    }
    const tuple = payment.result as readonly [bigint, boolean];
    snapshots.push({
      slug: space.slug,
      title: space.title,
      web3SpaceId: space.web3SpaceId,
      hasSpacePaid: Boolean(paid.result),
      freeTrialUsed: Boolean(tuple[1]),
      daysLeft: daysLeftFromExpiry(tuple[0]),
    });
  }

  return memberHomeSpacesAboutToExpire(snapshots);
}
