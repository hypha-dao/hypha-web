import 'server-only';

import { spaces as spacesTable } from '@hypha-platform/storage-postgres';
import { connectionFor } from './connection';
import type { DataRequest } from './types';

/** Every space's id, parent and on-chain id: the input of the organisation grouping. */
export async function readSpaceTree(
  request: DataRequest,
): Promise<
  { id: number; parentId: number | null; web3SpaceId: number | null }[]
> {
  return connectionFor(request)
    .select({
      id: spacesTable.id,
      parentId: spacesTable.parentId,
      web3SpaceId: spacesTable.web3SpaceId,
    })
    .from(spacesTable);
}
