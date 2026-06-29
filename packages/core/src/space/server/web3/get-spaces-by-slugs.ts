'use server';

import { db } from '@hypha-platform/storage-postgres';
import { findAllSpacesBySlugs } from '@hypha-platform/core/server';
import { Space } from '@hypha-platform/core/client';
import {
  fetchSpaceDetails,
  fetchSpaceProposalsIds,
} from '@hypha-platform/core/client';
import { formMap } from './internal';
import { mapDbSpaceToSpace } from '../map-db-space';

export async function getSpacesBySlugs(
  slugs: string[],
  { parentOnly = true }: { parentOnly?: boolean } = {},
): Promise<Space[]> {
  if (slugs.length === 0) return [];

  try {
    const spaces = await findAllSpacesBySlugs({ slugs, parentOnly }, { db });

    const spacesWithWeb3Id = spaces.filter(
      ({ web3SpaceId }) => web3SpaceId !== null,
    );
    const web3SpaceIds = spacesWithWeb3Id.map(({ web3SpaceId }) =>
      BigInt(web3SpaceId!),
    );
    const [web3details, web3proposalsIds] = await Promise.all([
      fetchSpaceDetails({ spaceIds: web3SpaceIds, allowFailure: true }),
      fetchSpaceProposalsIds({ spaceIds: web3SpaceIds, allowFailure: true }),
    ]);

    const details = formMap(web3details);
    const proposalsIds = formMap(web3proposalsIds);

    return spaces.map((space) => {
      const mappedSpace = mapDbSpaceToSpace(space);

      if (space.web3SpaceId === null) {
        return mappedSpace;
      }

      const spaceDetails = details.get(BigInt(space.web3SpaceId));
      const spaceProposals = proposalsIds.get(BigInt(space.web3SpaceId));
      const onChainDataMissing = !spaceDetails || !spaceProposals;

      return {
        ...mappedSpace,
        onChainDataMissing,
        memberCount: spaceDetails?.members?.length ?? 0,
        documentCount: spaceProposals?.accepted.length ?? 0,
      };
    });
  } catch (error) {
    throw new Error(`Failed to get spaces: ${error}`);
  }
}
