'use server';

import { db } from '@hypha-platform/storage-postgres';
import { findAllSpaces } from '@hypha-platform/core/server';
import { fetchSpaceProposalsIds } from '@hypha-platform/core/client';

export async function countAllAgreements(): Promise<number> {
  try {
    const spaces = await findAllSpaces({ db }, {});

    const spaceIds = spaces
      .filter(({ web3SpaceId }) => web3SpaceId !== null)
      .map(({ web3SpaceId }) => BigInt(web3SpaceId!));

    const proposals = await fetchSpaceProposalsIds({ spaceIds });

    return proposals.reduce(
      (accumulator, proposal) => accumulator + proposal.accepted.length,
      0,
    );
  } catch (error) {
    throw new Error(`Failed to count agreements: ${error}`);
  }
}
