import 'server-only';

import { web3Client } from '../../common/server/web3-rpc/client';
import { energyPpaV2Abi } from '../client/contracts';
import { readOwnershipTokenNames } from './read-ownership-token-name';
import { createTtlCache } from './ttl-cache';
import {
  assembleEnergyCommunitySnapshot,
  mapEnergySnapshotMemberDetail,
  mapEnergySnapshotOptimization,
  mapEnergySnapshotSource,
  type EnergyCommunityOnChainSnapshot,
  type EnergySnapshotMemberDetail,
  type EnergySnapshotSource,
} from './community-snapshot-map';

export type {
  EnergyCommunityOnChainSnapshot,
  EnergySnapshotMemberDetail,
  EnergySnapshotOptimization,
  EnergySnapshotSource,
} from './community-snapshot-map';

export {
  decodeEnergySourceId,
  assembleEnergyCommunitySnapshot,
  mapEnergySnapshotMemberDetail,
  mapEnergySnapshotOptimization,
  mapEnergySnapshotSource,
} from './community-snapshot-map';

/** Fresh enough for the Energy tab 15s poll without re-hitting Base RPC. */
export const ENERGY_COMMUNITY_SNAPSHOT_TTL_MS = 20_000;

const snapshotCache = createTtlCache<EnergyCommunityOnChainSnapshot>(
  ENERGY_COMMUNITY_SNAPSHOT_TTL_MS,
);

const COMMUNITY_VIEW_FNS = [
  'getCommunityFeeBps',
  'getAggregatorFeeBps',
  'getGridBalance',
  'getSettledBalance',
  'getContractStablecoinBalance',
  'verifyZeroSum',
  'getSourceIds',
  'getMemberAddresses',
  'getCommunityAddress',
  'getAggregatorAddress',
  'getGridOperator',
  'getExportDeviceId',
  'getOptimizationConfig',
  'getSocialWallets',
] as const;

const MEMBER_VIEW_FNS = [
  'getEnergyCreditBalance',
  'getDebtInStablecoin',
  'getCreditInStablecoin',
  'getAllSourceOwnerships',
  'getMember',
] as const;

type EnergyCall = {
  address: `0x${string}`;
  abi: typeof energyPpaV2Abi;
  functionName: string;
  args?: readonly unknown[];
};

type MulticallRow = {
  status: 'success' | 'failure';
  result?: unknown;
};

const toLowerHex = (address: string) => address.toLowerCase() as `0x${string}`;

function viewCall(
  proxy: `0x${string}`,
  functionName: string,
  args?: readonly unknown[],
): EnergyCall {
  return {
    address: proxy,
    abi: energyPpaV2Abi,
    functionName,
    ...(args ? { args } : {}),
  };
}

function multicallValue<T>(row: MulticallRow | undefined): T | null {
  if (row?.status !== 'success') return null;
  return row.result as T;
}

async function energyMulticall(calls: EnergyCall[]): Promise<MulticallRow[]> {
  if (calls.length === 0) return [];
  return (await web3Client.multicall({
    allowFailure: true,
    contracts: calls as never,
  })) as MulticallRow[];
}

async function safeRead<V>(
  proxy: `0x${string}`,
  functionName: string,
  args?: readonly unknown[],
): Promise<V | null> {
  try {
    return (await web3Client.readContract({
      address: proxy,
      abi: energyPpaV2Abi,
      functionName: functionName as never,
      ...(args ? { args: args as never } : {}),
    })) as V;
  } catch (error: unknown) {
    const message =
      (error as { shortMessage?: string })?.shortMessage ||
      (error as Error)?.message ||
      String(error);
    console.warn(
      `[spaces/energy] readContract(${functionName}) failed on ${proxy}: ${message}`,
    );
    return null;
  }
}

type SourceTuple = readonly [number, `0x${string}`, bigint, boolean];
type OwnershipTuple = readonly [readonly `0x${string}`[], readonly bigint[]];
type MemberRecord = {
  memberAddress: `0x${string}`;
  deviceIds: readonly bigint[];
  isActive: boolean;
  metadataHash: `0x${string}`;
};
type OptimizationTuple = readonly [
  readonly number[],
  number,
  bigint,
  number,
  boolean,
];
type SocialWalletRow = { wallet: `0x${string}`; shareBps: number };

async function readSourcesAndMembers(
  proxy: `0x${string}`,
  sourceIds: readonly `0x${string}`[],
  memberAddresses: readonly `0x${string}`[],
  viaMulticall: boolean,
): Promise<{
  sources: EnergySnapshotSource[];
  memberDetails: EnergySnapshotMemberDetail[];
}> {
  const memberCalls = memberAddresses.flatMap((address) =>
    MEMBER_VIEW_FNS.map((functionName) =>
      viewCall(proxy, functionName, [address]),
    ),
  );
  const sourceCalls = sourceIds.map((sourceId) =>
    viewCall(proxy, 'getSource', [sourceId]),
  );

  let sourceRows: Array<SourceTuple | null>;
  let memberSlices: Array<{
    creditBalance: bigint | null;
    debtStablecoin: bigint | null;
    creditStablecoin: bigint | null;
    ownerships: OwnershipTuple | null;
    memberRecord: MemberRecord | null;
  }>;

  if (viaMulticall) {
    const results = await energyMulticall([...sourceCalls, ...memberCalls]);
    sourceRows = sourceIds.map((_, index) =>
      multicallValue<SourceTuple>(results[index]),
    );
    memberSlices = memberAddresses.map((_, memberIndex) => {
      const offset = sourceCalls.length + memberIndex * MEMBER_VIEW_FNS.length;
      return {
        creditBalance: multicallValue<bigint>(results[offset]),
        debtStablecoin: multicallValue<bigint>(results[offset + 1]),
        creditStablecoin: multicallValue<bigint>(results[offset + 2]),
        ownerships: multicallValue<OwnershipTuple>(results[offset + 3]),
        memberRecord: multicallValue<MemberRecord>(results[offset + 4]),
      };
    });
  } else {
    const [sourceResults, memberResults] = await Promise.all([
      Promise.all(
        sourceIds.map((sourceId) =>
          safeRead<SourceTuple>(proxy, 'getSource', [sourceId]),
        ),
      ),
      Promise.all(
        memberAddresses.map(async (address) => {
          const [
            creditBalance,
            debtStablecoin,
            creditStablecoin,
            ownerships,
            memberRecord,
          ] = await Promise.all([
            safeRead<bigint>(proxy, 'getEnergyCreditBalance', [address]),
            safeRead<bigint>(proxy, 'getDebtInStablecoin', [address]),
            safeRead<bigint>(proxy, 'getCreditInStablecoin', [address]),
            safeRead<OwnershipTuple>(proxy, 'getAllSourceOwnerships', [
              address,
            ]),
            safeRead<MemberRecord>(proxy, 'getMember', [address]),
          ]);
          return {
            creditBalance,
            debtStablecoin,
            creditStablecoin,
            ownerships,
            memberRecord,
          };
        }),
      ),
    ]);
    sourceRows = sourceResults;
    memberSlices = memberResults;
  }

  const ownershipTokens = sourceRows.flatMap((value, index) =>
    value && sourceIds[index] ? [value[1]] : [],
  );
  const tokenNamesByAddress = await readOwnershipTokenNames(ownershipTokens);

  const sources = sourceRows
    .map((value, index) => {
      const sourceId = sourceIds[index];
      if (!sourceId) return null;
      return mapEnergySnapshotSource(
        sourceId,
        value,
        tokenNamesByAddress[value ? value[1].toLowerCase() : ''],
      );
    })
    .filter((row): row is EnergySnapshotSource => row !== null);

  const memberDetails = memberAddresses.map((address, index) =>
    mapEnergySnapshotMemberDetail(address, memberSlices[index]!),
  );

  return { sources, memberDetails };
}

async function readCommunitySnapshotUncached(
  communityProxyAddress: string,
): Promise<EnergyCommunityOnChainSnapshot> {
  const proxy = toLowerHex(communityProxyAddress);

  const readCommunityViews = async (viaMulticall: boolean) => {
    if (viaMulticall) {
      const results = await energyMulticall(
        COMMUNITY_VIEW_FNS.map((functionName) => viewCall(proxy, functionName)),
      );
      return {
        communityFeeBps: multicallValue<number>(results[0]),
        aggregatorFeeBps: multicallValue<number>(results[1]),
        gridBalance: multicallValue<bigint>(results[2]),
        settledBalance: multicallValue<bigint>(results[3]),
        contractStablecoinBalance: multicallValue<bigint>(results[4]),
        zeroSumStatus: multicallValue<readonly [boolean, bigint]>(results[5]),
        sourceIds: multicallValue<readonly `0x${string}`[]>(results[6]) ?? [],
        memberAddresses:
          multicallValue<readonly `0x${string}`[]>(results[7]) ?? [],
        communityAddress: multicallValue<`0x${string}`>(results[8]),
        aggregatorAddress: multicallValue<`0x${string}`>(results[9]),
        gridOperator: multicallValue<`0x${string}`>(results[10]),
        exportDeviceId: multicallValue<bigint>(results[11]),
        optimizationConfig: multicallValue<OptimizationTuple>(results[12]),
        socialWalletsRaw: multicallValue<readonly SocialWalletRow[]>(
          results[13],
        ),
      };
    }

    const [
      communityFeeBps,
      aggregatorFeeBps,
      gridBalance,
      settledBalance,
      contractStablecoinBalance,
      zeroSumStatus,
      sourceIds,
      memberAddresses,
      communityAddress,
      aggregatorAddress,
      gridOperator,
      exportDeviceId,
      optimizationConfig,
      socialWalletsRaw,
    ] = await Promise.all([
      safeRead<number>(proxy, 'getCommunityFeeBps'),
      safeRead<number>(proxy, 'getAggregatorFeeBps'),
      safeRead<bigint>(proxy, 'getGridBalance'),
      safeRead<bigint>(proxy, 'getSettledBalance'),
      safeRead<bigint>(proxy, 'getContractStablecoinBalance'),
      safeRead<readonly [boolean, bigint]>(proxy, 'verifyZeroSum'),
      safeRead<readonly `0x${string}`[]>(proxy, 'getSourceIds'),
      safeRead<readonly `0x${string}`[]>(proxy, 'getMemberAddresses'),
      safeRead<`0x${string}`>(proxy, 'getCommunityAddress'),
      safeRead<`0x${string}`>(proxy, 'getAggregatorAddress'),
      safeRead<`0x${string}`>(proxy, 'getGridOperator'),
      safeRead<bigint>(proxy, 'getExportDeviceId'),
      safeRead<OptimizationTuple>(proxy, 'getOptimizationConfig'),
      safeRead<readonly SocialWalletRow[]>(proxy, 'getSocialWallets'),
    ]);

    return {
      communityFeeBps,
      aggregatorFeeBps,
      gridBalance,
      settledBalance,
      contractStablecoinBalance,
      zeroSumStatus,
      sourceIds: sourceIds ?? [],
      memberAddresses: memberAddresses ?? [],
      communityAddress,
      aggregatorAddress,
      gridOperator,
      exportDeviceId,
      optimizationConfig,
      socialWalletsRaw,
    };
  };

  let communityViews: Awaited<ReturnType<typeof readCommunityViews>>;
  let usedMulticall = true;
  try {
    communityViews = await readCommunityViews(true);
  } catch (error) {
    console.warn(
      '[spaces/energy] community multicall failed; falling back to per-call reads',
      error,
    );
    usedMulticall = false;
    communityViews = await readCommunityViews(false);
  }

  let sourcesAndMembers: Awaited<ReturnType<typeof readSourcesAndMembers>>;
  try {
    sourcesAndMembers = await readSourcesAndMembers(
      proxy,
      communityViews.sourceIds,
      communityViews.memberAddresses,
      usedMulticall,
    );
  } catch (error) {
    if (!usedMulticall) throw error;
    console.warn(
      '[spaces/energy] member/source multicall failed; falling back to per-call reads',
      error,
    );
    sourcesAndMembers = await readSourcesAndMembers(
      proxy,
      communityViews.sourceIds,
      communityViews.memberAddresses,
      false,
    );
  }

  return assembleEnergyCommunitySnapshot({
    communityFeeBps: communityViews.communityFeeBps,
    aggregatorFeeBps: communityViews.aggregatorFeeBps,
    gridBalance: communityViews.gridBalance,
    settledBalance: communityViews.settledBalance,
    contractStablecoinBalance: communityViews.contractStablecoinBalance,
    zeroSumStatus: communityViews.zeroSumStatus,
    memberAddresses: communityViews.memberAddresses,
    sourceCount: communityViews.sourceIds.length,
    sources: sourcesAndMembers.sources,
    memberDetails: sourcesAndMembers.memberDetails,
    communityAddress: communityViews.communityAddress,
    aggregatorAddress: communityViews.aggregatorAddress,
    gridOperator: communityViews.gridOperator,
    exportDeviceId: communityViews.exportDeviceId,
    optimization: mapEnergySnapshotOptimization(
      communityViews.optimizationConfig,
      communityViews.socialWalletsRaw,
    ),
  });
}

/**
 * Full EnergyPPAv2 view the space Energy tab needs, in two RPC waves
 * (community views, then sources + per-member details) instead of one
 * HTTP round-trip per Solidity getter. Successful snapshots are cached
 * and concurrent callers share one load.
 */
export async function readEnergyCommunitySnapshot(
  communityProxyAddress: string,
): Promise<EnergyCommunityOnChainSnapshot> {
  const cacheKey = communityProxyAddress.trim().toLowerCase();
  const snapshot = await snapshotCache.getOrLoad(cacheKey, () =>
    readCommunitySnapshotUncached(communityProxyAddress),
  );
  return structuredClone(snapshot);
}

export function peekEnergyCommunitySnapshot(
  communityProxyAddress: string,
): EnergyCommunityOnChainSnapshot | undefined {
  return snapshotCache.get(communityProxyAddress.trim().toLowerCase());
}

/** Test helper. */
export function clearEnergyCommunitySnapshotCache() {
  snapshotCache.clear();
}
