import type { DbConfig } from '../../common/server/types';
import { web3Client } from '../../common/server/web3-rpc/client';
import { getSpaceProposals } from '../client/web3/dao-space-factory/get-space-proposals';
import { getSpaceDetails } from '../shared/web3/get-space-details';
import type { Space } from '../types';
import {
  directoryCensusFromCalls,
  type DirectoryCensusRow,
} from './network-directory-census';
import { mapDbSpaceToSpace } from './map-db-space';
import { findAllSpaces } from './queries';

type FindAllSpacesProps = {
  search?: string;
  parentOnly?: boolean;
  omitSandbox?: boolean;
  omitArchived?: boolean;
};

/** Spaces per multicall. Each space is two calls (members + accepted proposals). */
const CHAIN_CHUNK = 80;
const CHAIN_CONCURRENCY = 3;

async function readChainChunk(
  web3SpaceIds: number[],
): Promise<DirectoryCensusRow[]> {
  const contracts = web3SpaceIds.flatMap((web3SpaceId) => [
    getSpaceDetails({ spaceId: BigInt(web3SpaceId) }),
    getSpaceProposals({ spaceId: BigInt(web3SpaceId) }),
  ]);
  const results = await web3Client.multicall({
    allowFailure: true,
    blockTag: 'safe',
    contracts,
  });

  return web3SpaceIds.map((web3SpaceId, index) =>
    directoryCensusFromCalls(
      web3SpaceId,
      results[index * 2],
      results[index * 2 + 1],
    ),
  );
}

/**
 * Members and agreements for the network census.
 *
 * Postgres `memberships` is not written by this app, and `documents.state`
 * is not the accepted-agreement list. The live figures are the on-chain
 * member list and accepted proposal ids. Each finished batch is reported
 * so the directory can paint before the rest of the chain answers.
 */
export async function readNetworkDirectoryCensus(
  web3SpaceIds: number[],
  onChunk: (rows: DirectoryCensusRow[]) => void,
  signal?: AbortSignal,
) {
  const chunks: number[][] = [];
  for (let index = 0; index < web3SpaceIds.length; index += CHAIN_CHUNK) {
    chunks.push(web3SpaceIds.slice(index, index + CHAIN_CHUNK));
  }

  for (let index = 0; index < chunks.length; index += CHAIN_CONCURRENCY) {
    if (signal?.aborted) return;
    const wave = chunks.slice(index, index + CHAIN_CONCURRENCY);
    await Promise.all(
      wave.map(async (chunk) => {
        try {
          const rows = await readChainChunk(chunk);
          if (!signal?.aborted) onChunk(rows);
        } catch (error) {
          console.error(
            '[readNetworkDirectoryCensus] Failed to load chain census chunk',
            error,
          );
        }
      }),
    );
  }
}

/**
 * Spaces for the network page from Postgres.
 *
 * Member and agreement figures are loaded afterwards. A space with no
 * on-chain id cannot have members, so it is marked empty here and drops
 * out of the directory. A failed later chain read must not do that.
 */
export async function getNetworkDirectorySpaces(
  { db }: DbConfig,
  props: FindAllSpacesProps = {},
): Promise<Space[]> {
  const spaceRows = await findAllSpaces({ db }, props);
  return spaceRows.map((space) => {
    const mapped = mapDbSpaceToSpace(space);
    if (mapped.web3SpaceId == null) {
      return { ...mapped, memberCount: 0 };
    }
    return mapped;
  });
}
