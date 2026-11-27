import 'server-only';

import {
  findSpaceById as findSpaceByIdQuery,
  findSpaceHostFieldsBySlug as findSpaceHostFieldsBySlugQuery,
  findSpaceWithSubspacesBySlug as findSpaceWithSubspacesBySlugQuery,
} from '../space/server/queries';
import { getAllSpaces } from '../space/server/web3/get-all-spaces';
import { getSpacesBySlugs } from '../space/server/web3/get-spaces-by-slugs';
import { getSpacesByWeb3Ids } from '../space/server/web3/get-spaces-by-web3-ids';
import { connectionFor } from './connection';
import type { DataRequest } from './types';

export function findSpaceHostFieldsBySlug(
  request: DataRequest,
  input: Parameters<typeof findSpaceHostFieldsBySlugQuery>[0],
) {
  return findSpaceHostFieldsBySlugQuery(input, { db: connectionFor(request) });
}

export function findSpaceById(
  request: DataRequest,
  input: Parameters<typeof findSpaceByIdQuery>[0],
) {
  return findSpaceByIdQuery(input, { db: connectionFor(request) });
}

export function findSpaceWithSubspacesBySlug(
  request: DataRequest,
  input: Parameters<typeof findSpaceWithSubspacesBySlugQuery>[0],
) {
  return findSpaceWithSubspacesBySlugQuery(input, {
    db: connectionFor(request),
  });
}

export function listAllSpaces(
  request: DataRequest,
  props: Parameters<typeof getAllSpaces>[0],
) {
  return getAllSpaces(props, connectionFor(request));
}

export function listSpacesBySlugs(
  request: DataRequest,
  slugs: string[],
  options?: Parameters<typeof getSpacesBySlugs>[1],
) {
  return getSpacesBySlugs(slugs, options, connectionFor(request));
}

export function listSpacesByWeb3Ids(
  request: DataRequest,
  web3SpaceIds: number[],
  options?: Parameters<typeof getSpacesByWeb3Ids>[1],
) {
  return getSpacesByWeb3Ids(web3SpaceIds, options, connectionFor(request));
}
