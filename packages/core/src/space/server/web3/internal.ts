'use server';

import {
  fetchSpaceDetails,
  fetchSpaceProposalsIds,
} from '@hypha-platform/core/client';
import { Space } from '@hypha-platform/core/client';

export async function addWeb3DataToSpaces(spaces: Space[]): Promise<Space[]> {
  const web3SpaceIds = spaces.map(({ id }) => BigInt(id));
  const [details, proposalsIds] = await Promise.all([
    fetchSpaceDetails({ spaceIds: web3SpaceIds }),
    fetchSpaceProposalsIds({ spaceIds: web3SpaceIds }),
  ]);

  return spaces.map((space) => {
    const members = details.find(
      ({ spaceId }) => space.id === Number(spaceId),
    )?.members;
    // counting only accepted ones according to #771
    const agreements = proposalsIds.find(
      ({ spaceId }) => space.id === Number(spaceId),
    )?.accepted;

    return {
      ...space,
      memberCount: members?.length ?? 0,
      documentCount: agreements?.length ?? 0,
    };
  });
}
