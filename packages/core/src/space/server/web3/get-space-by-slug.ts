'use server';

import { db } from '@hypha-platform/storage-postgres';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { Space } from '@hypha-platform/core/client';
import {
  fetchSpaceDetails,
  fetchSpaceProposalsIds,
} from '@hypha-platform/core/client';

interface GetSpaceBySlugProps {
  slug: string;
}

export async function getSpaceBySlug({
  slug,
}: GetSpaceBySlugProps): Promise<Space | null> {
  try {
    const space = await findSpaceBySlug({ slug }, { db });

    if (!space) return null;

    const spacesWithWeb3Id = BigInt(space?.web3SpaceId ?? 0);
    if (spacesWithWeb3Id === 0n) {
      return space;
    }

    const web3SpaceIds = [spacesWithWeb3Id];
    const [web3details, web3proposalsIds] = await Promise.all([
      fetchSpaceDetails({ spaceIds: web3SpaceIds }),
      fetchSpaceProposalsIds({ spaceIds: web3SpaceIds }),
    ]);

    const [spaceDetails] = web3details;
    const [spaceProposals] = web3proposalsIds;

    return {
      ...space,
      memberCount: spaceDetails?.members?.length ?? 0,
      memberAddresses: Array.isArray(spaceDetails?.members)
        ? (spaceDetails!.members
            .filter((m): m is string => typeof m === 'string')
            .map((m) => m.toLowerCase()) as `0x{string}`[])
        : [],
      documentCount: spaceProposals?.accepted.length ?? 0,
    };
  } catch (error) {
    throw new Error('Failed to get space', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
