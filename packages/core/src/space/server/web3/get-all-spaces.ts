'use server';

import { db } from '@hypha-platform/storage-postgres';
import { findAllSpaces } from '@hypha-platform/core/server';
import { Space } from '@hypha-platform/core/client';
import {
  fetchSpaceDetails,
  fetchSpaceProposalsIds,
} from '@hypha-platform/core/client';
import { formMap } from './internal';

interface GetAllSpacesProps {
  search?: string;
  parentOnly?: boolean;
  omitSandbox?: boolean;
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
      fetchSpaceDetails({ spaceIds: web3SpaceIds }),
      fetchSpaceProposalsIds({ spaceIds: web3SpaceIds }),
    ]);

    const details = formMap(web3details);
    const proposalsIds = formMap(web3proposalsIds);

    return spaces.map((space) => {
      if (space.web3SpaceId === null) {
        return space;
      }

      const spaceDetails = details.get(BigInt(space.web3SpaceId));
      const spaceProposals = proposalsIds.get(BigInt(space.web3SpaceId));

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
    });
  } catch (error) {
    throw new Error('Failed to get spaces', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
