'use server';

import { db } from '@hypha-platform/storage-postgres';
import { findAllSpaces } from '@hypha-platform/core/server';
import { Space } from '@hypha-platform/core/client';
import { addWeb3DataToSpaces } from './internal';

interface GetAllSpacesProps {
  search?: string;
}

export async function getAllSpaces(
  props: GetAllSpacesProps = {},
): Promise<Space[]> {
  try {
    const spaces = await findAllSpaces({ db }, props);
    return await addWeb3DataToSpaces(spaces);
  } catch (error) {
    throw new Error(`Failed to get spaces: ${error}`);
  }
}
