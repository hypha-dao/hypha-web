import { readEnergyCommunityMemberAddresses } from '@hypha-platform/core/server';
import {
  fetchSpaceDetails,
  fetchSpaceProposalsIds,
} from '@hypha-platform/core/client';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

export async function getSpaceMemberAndAgreementCounts(
  web3SpaceId: unknown,
): Promise<{
  members: number | null;
  memberAddresses: readonly string[];
  agreements: number | null;
}> {
  if (!canConvertToBigInt(web3SpaceId)) {
    return { members: null, memberAddresses: [], agreements: null };
  }
  const id = BigInt(web3SpaceId);
  const [memberResult, agreements] = await Promise.all([
    (async () => {
      try {
        const [spaceDetails] = await fetchSpaceDetails({
          spaceIds: [id],
        });
        const memberAddresses = spaceDetails?.members ?? [];
        return {
          members: memberAddresses.length,
          memberAddresses,
        };
      } catch (error) {
        console.error(
          `Failed to get space details for a space ${web3SpaceId}:`,
          error,
        );
        return { members: null, memberAddresses: [] as readonly string[] };
      }
    })(),
    (async () => {
      try {
        const [proposals] = await fetchSpaceProposalsIds({
          spaceIds: [id],
        });
        return proposals?.accepted?.length ?? 0;
      } catch (error) {
        console.error(
          `Failed to get space proposals for a space ${web3SpaceId}:`,
          error,
        );
        return null;
      }
    })(),
  ]);
  return {
    members: memberResult.members,
    memberAddresses: memberResult.memberAddresses,
    agreements,
  };
}

export async function resolveHeroMemberAndAgreementCounts(
  daoSlug: string,
  web3SpaceId: unknown,
): Promise<{ members: number | null; agreements: number | null }> {
  const [memberCounts, energyMembers] = await Promise.all([
    getSpaceMemberAndAgreementCounts(web3SpaceId),
    readEnergyCommunityMemberAddresses(daoSlug, { db }).catch((error) => {
      console.error('Failed to read energy community members:', error);
      return { status: 'unavailable' as const };
    }),
  ]);
  const {
    members: rawSpaceMembers,
    memberAddresses,
    agreements,
  } = memberCounts;
  const members =
    energyMembers.status === 'ok' && rawSpaceMembers !== null
      ? memberAddresses.filter((address) =>
          energyMembers.addresses.has(address.toLowerCase()),
        ).length
      : rawSpaceMembers;
  return { members, agreements };
}
