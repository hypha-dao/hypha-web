'use server';

import { db } from '@hypha-platform/storage-postgres';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import type { Space } from '@hypha-platform/core/client';
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

    const web3SpaceId =
      typeof space.web3SpaceId === 'number' &&
      Number.isSafeInteger(space.web3SpaceId) &&
      space.web3SpaceId > 0
        ? BigInt(space.web3SpaceId)
        : 0n;
    if (web3SpaceId === 0n) {
      return space;
    }

    const web3SpaceIds = [web3SpaceId];

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
        ? spaceDetails.members
            .filter((m): m is string => typeof m === 'string')
            .map((m) => m.toLowerCase())
            .filter((m): m is `0x${string}` => /^0x[a-f0-9]{40}$/.test(m))
        : [],
      documentCount: spaceProposals?.accepted.length ?? 0,
    };
  } catch (error) {
    throw new Error('Failed to get space', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
