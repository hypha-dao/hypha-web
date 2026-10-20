import type { DbConfig } from '../../common/server/types';
import { web3Client } from '../../common/server/web3-rpc/client';
import { getSpaceProposals } from '../client/web3/dao-space-factory/get-space-proposals';
import { getSpaceDetails } from '../shared/web3/get-space-details';
import type { Space } from '../types';
import { mapDbSpaceToSpace } from './map-db-space';
import { attachNetworkCensusCounts } from './network-directory-census';
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

function memberAddressesFrom(result: unknown): `0x${string}`[] {
  if (!Array.isArray(result) || result.length < 5) return [];
  const members = result[4];
  if (!Array.isArray(members)) return [];
  return members.flatMap((value) => {
    if (typeof value !== 'string') return [];
    const address = value.toLowerCase();
    return /^0x[0-9a-f]{40}$/.test(address) ? [address as `0x${string}`] : [];
  });
}

function acceptedCountFrom(result: unknown): number | null {
  if (!Array.isArray(result) || result.length < 1) return null;
  const accepted = result[0];
  return Array.isArray(accepted) ? accepted.length : null;
}

/** Creator is the 9th getSpaceDetails field. A zero address is not a person. */
function creatorAddressFrom(result: unknown): string | null {
  if (!Array.isArray(result) || result.length < 9) return null;
  const creator = result[8];
  if (typeof creator !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(creator)) {
    return null;
  }
  if (creator.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    return null;
  }
  return creator;
}

async function readChainChunk(
  web3SpaceIds: number[],
  membersByWeb3Id: Map<number, `0x${string}`[]>,
  agreementsByWeb3Id: Map<number, number>,
  creatorsByWeb3Id: Map<number, string>,
) {
  const contracts = web3SpaceIds.flatMap((web3SpaceId) => [
    getSpaceDetails({ spaceId: BigInt(web3SpaceId) }),
    getSpaceProposals({ spaceId: BigInt(web3SpaceId) }),
  ]);
  const results = await web3Client.multicall({
    allowFailure: true,
    blockTag: 'safe',
    contracts,
  });

  web3SpaceIds.forEach((web3SpaceId, index) => {
    const details = results[index * 2];
    const proposals = results[index * 2 + 1];
    if (details?.status === 'success') {
      membersByWeb3Id.set(web3SpaceId, memberAddressesFrom(details.result));
      const creator = creatorAddressFrom(details.result);
      if (creator) creatorsByWeb3Id.set(web3SpaceId, creator);
    }
    if (proposals?.status === 'success') {
      const accepted = acceptedCountFrom(proposals.result);
      if (accepted != null) agreementsByWeb3Id.set(web3SpaceId, accepted);
    }
  });
}

/**
 * Members and agreements for the network census.
 *
 * Postgres `memberships` is not written by this app, and `documents.state`
 * is not the accepted-agreement list. Both queries returned empty maps, so
 * the census showed 0 while spaces and tokens still loaded. The live figures
 * are the on-chain member list and accepted proposal ids.
 */
async function readChainCensus(web3SpaceIds: number[]) {
  const membersByWeb3Id = new Map<number, `0x${string}`[]>();
  const agreementsByWeb3Id = new Map<number, number>();
  const creatorsByWeb3Id = new Map<number, string>();
  const chunks: number[][] = [];
  for (let index = 0; index < web3SpaceIds.length; index += CHAIN_CHUNK) {
    chunks.push(web3SpaceIds.slice(index, index + CHAIN_CHUNK));
  }

  for (let index = 0; index < chunks.length; index += CHAIN_CONCURRENCY) {
    const wave = chunks.slice(index, index + CHAIN_CONCURRENCY);
    await Promise.all(
      wave.map(async (chunk) => {
        try {
          await readChainChunk(
            chunk,
            membersByWeb3Id,
            agreementsByWeb3Id,
            creatorsByWeb3Id,
          );
        } catch (error) {
          console.error(
            '[getNetworkDirectorySpaces] Failed to load chain census chunk',
            error,
          );
        }
      }),
    );
  }

  return { membersByWeb3Id, agreementsByWeb3Id, creatorsByWeb3Id };
}

/**
 * Spaces for the network page from Postgres, with member and agreement
 * counts from the chain. A failed chain read leaves those counts off. It
 * must not drop the directory or mark every space archived.
 */
export async function getNetworkDirectorySpaces(
  { db }: DbConfig,
  props: FindAllSpacesProps = {},
): Promise<Space[]> {
  const spaceRows = await findAllSpaces({ db }, props);
  const spaces = spaceRows.map((space) => mapDbSpaceToSpace(space));
  const web3SpaceIds = [
    ...new Set(
      spaces.flatMap((space) =>
        typeof space.web3SpaceId === 'number' && space.web3SpaceId > 0
          ? [space.web3SpaceId]
          : [],
      ),
    ),
  ];

  if (web3SpaceIds.length === 0) return spaces;

  const { membersByWeb3Id, agreementsByWeb3Id, creatorsByWeb3Id } =
    await readChainCensus(web3SpaceIds);
  return attachNetworkCensusCounts(
    spaces,
    membersByWeb3Id,
    agreementsByWeb3Id,
  ).map((space) => {
    const web3SpaceId = space.web3SpaceId;
    if (typeof web3SpaceId !== 'number') return space;
    const creatorAddress = creatorsByWeb3Id.get(web3SpaceId);
    return creatorAddress ? { ...space, creatorAddress } : space;
  });
}
