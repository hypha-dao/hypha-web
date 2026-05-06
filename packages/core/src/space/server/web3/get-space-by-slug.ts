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

    let web3details: Awaited<ReturnType<typeof fetchSpaceDetails>> = [];
    let web3proposalsIds: Awaited<ReturnType<typeof fetchSpaceProposalsIds>> =
      [];

    try {
      [web3details, web3proposalsIds] = await Promise.all([
        fetchSpaceDetails({ spaceIds: web3SpaceIds }),
        fetchSpaceProposalsIds({ spaceIds: web3SpaceIds }),
      ]);
    } catch (error) {
      console.error('[getSpaceBySlug] Failed to fetch web3 enrichment', {
        error,
        slug,
        web3SpaceId: web3SpaceId.toString(),
      });
      return {
        ...space,
        memberCount: 0,
        memberAddresses: [],
        documentCount: 0,
        onChainDataMissing: true,
      };
    }

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
    console.error('[getSpaceBySlug] Failed to fetch space', { error, slug });
    throw new Error('Failed to get space', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
