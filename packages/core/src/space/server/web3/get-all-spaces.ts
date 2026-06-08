'use server';

import { db } from '@hypha-platform/storage-postgres';
import { findAllSpaces } from '@hypha-platform/core/server';
import { Space, isSpaceArchived } from '@hypha-platform/core/client';
import {
  fetchSpaceDetails,
  fetchSpaceProposalsIds,
} from '@hypha-platform/core/client';
import { formMap, readWithWarmupRetry } from './internal';
import { mapDbSpaceToSpace } from '../map-db-space';

interface GetAllSpacesProps {
  search?: string;
  parentOnly?: boolean;
  omitSandbox?: boolean;
  omitArchived?: boolean;
}

export async function getAllSpaces(
  props: GetAllSpacesProps = {},
): Promise<Space[]> {
  try {
    const spaces = await findAllSpaces({ db }, props);

    const spacesWithWeb3Id = spaces.filter(
      ({ web3SpaceId }) => web3SpaceId !== null,
    );
    const web3SpaceIds = spacesWithWeb3Id.map(({ web3SpaceId }) =>
      BigInt(web3SpaceId!),
    );

    const [web3details, web3proposalsIds] = await Promise.all([
      readWithWarmupRetry({
        label: 'getAllSpaces/space-details',
        spaceIds: web3SpaceIds,
        read: () =>
          fetchSpaceDetails({ spaceIds: web3SpaceIds, allowFailure: true }),
      }).catch<Awaited<ReturnType<typeof fetchSpaceDetails>>>((error) => {
        console.error('[getAllSpaces] Failed to fetch space details', {
          error,
          web3SpaceCount: web3SpaceIds.length,
        });
        return [];
      }),
      readWithWarmupRetry({
        label: 'getAllSpaces/space-proposals',
        spaceIds: web3SpaceIds,
        read: () =>
          fetchSpaceProposalsIds({
            spaceIds: web3SpaceIds,
            allowFailure: true,
          }),
      }).catch<Awaited<ReturnType<typeof fetchSpaceProposalsIds>>>((error) => {
        console.error('[getAllSpaces] Failed to fetch space proposals ids', {
          error,
          web3SpaceCount: web3SpaceIds.length,
        });
        return [];
      }),
    ]);

    const details = formMap(web3details);
    const proposalsIds = formMap(web3proposalsIds);

    const enrichedSpaces = spaces.map((space) => {
      const mappedSpace = mapDbSpaceToSpace(space);

      if (space.web3SpaceId === null) {
        // No web3 data = no on-chain members, treat as archived when filtering
        return { ...mappedSpace, memberCount: 0 };
      }

      const spaceDetails = details.get(BigInt(space.web3SpaceId));
      const spaceProposals = proposalsIds.get(BigInt(space.web3SpaceId));

      return {
        ...mappedSpace,
        memberCount: spaceDetails?.members?.length ?? 0,
        memberAddresses: Array.isArray(spaceDetails?.members)
          ? (spaceDetails!.members
              .filter((m): m is string => typeof m === 'string')
              .map((m) => m.toLowerCase()) as `0x{string}`[])
          : [],
        documentCount: spaceProposals?.accepted.length ?? 0,
      };
    });

    if (props.omitArchived) {
      return enrichedSpaces.filter((space) => !isSpaceArchived(space));
    }

    return enrichedSpaces;
  } catch (error) {
    console.error('[getAllSpaces] Failed to fetch spaces from database', {
      error,
      filters: props,
    });
    throw new Error('Failed to get spaces', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
