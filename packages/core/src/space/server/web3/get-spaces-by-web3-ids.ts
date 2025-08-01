'use server';

import { db } from '@hypha-platform/storage-postgres';
import { findAllSpacesByWeb3SpaceIds } from '@hypha-platform/core/server';
import { Space } from '@hypha-platform/core/client';
import { addWeb3DataToSpaces } from './internal';

export async function getSpacesByWeb3Ids(spaceIds: number[]): Promise<Space[]> {
  if (spaceIds.length === 0) return [];

  try {
    const spaces = await findAllSpacesByWeb3SpaceIds(
      { web3SpaceIds: spaceIds },
      { db },
    );
    return await addWeb3DataToSpaces(spaces);
  } catch (error) {
    throw new Error(`Failed to get spaces: ${error}`);
  }
}
