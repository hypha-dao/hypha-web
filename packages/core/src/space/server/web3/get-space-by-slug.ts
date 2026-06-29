'use server';

import { db } from '@hypha-platform/storage-postgres';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import type { Space } from '@hypha-platform/core/client';
import {
  fetchSpaceDetails,
  fetchSpaceProposalsIds,
} from '@hypha-platform/core/client';
import { readWithWarmupRetry } from './internal';
import { mapDbSpaceToSpace } from '../map-db-space';

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
      return mapDbSpaceToSpace(space);
    }

    const web3SpaceIds = [web3SpaceId];

    const [web3details, web3proposalsIds] = await Promise.all([
      readWithWarmupRetry({
        label: 'getSpaceBySlug/space-details',
        spaceIds: web3SpaceIds,
        read: () =>
          fetchSpaceDetails({ spaceIds: web3SpaceIds, allowFailure: true }),
      }).catch<Awaited<ReturnType<typeof fetchSpaceDetails>>>((error) => {
        console.error('[getSpaceBySlug] Failed to fetch space details', {
          error,
          slug,
          web3SpaceId: web3SpaceId.toString(),
        });
        return [];
      }),
      readWithWarmupRetry({
        label: 'getSpaceBySlug/space-proposals',
        spaceIds: web3SpaceIds,
        read: () =>
          fetchSpaceProposalsIds({
            spaceIds: web3SpaceIds,
            allowFailure: true,
          }),
      }).catch<Awaited<ReturnType<typeof fetchSpaceProposalsIds>>>((error) => {
        console.error('[getSpaceBySlug] Failed to fetch space proposals ids', {
          error,
          slug,
          web3SpaceId: web3SpaceId.toString(),
        });
        return [];
      }),
    ]);

    const [spaceDetails] = web3details;
    const [spaceProposals] = web3proposalsIds;

    return {
      ...mapDbSpaceToSpace(space),
      memberCount: spaceDetails?.members?.length ?? 0,
      memberAddresses: Array.isArray(spaceDetails?.members)
        ? spaceDetails.members
            .filter((m): m is string => typeof m === 'string')
            .map((m) => m.toLowerCase())
            .filter((m): m is `0x${string}` => /^0x[a-f0-9]{40}$/.test(m))
        : [],
      documentCount: spaceProposals?.accepted.length ?? 0,
      onChainDataMissing: !spaceDetails || !spaceProposals,
    };
  } catch (error) {
    console.error('[getSpaceBySlug] Failed to fetch space', { error, slug });
    throw new Error('Failed to get space', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
