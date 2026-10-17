import 'server-only';

import { daoProposalsImplementationAbi } from '../../generated';
import { daoProposalsImplementationAddress } from '../../generated';
import { web3Client } from '../../common/server/web3-rpc/client';
import { getProposalDetails } from '../../governance/client/web3/get-proposal-details';
import { getProposalVoters } from '../../governance/client/web3/get-proposal-voters';
import { getSpaceProposals } from '../../space/client/web3/dao-space-factory/get-space-proposals';
import { getWithdrawnProposalsBySpace } from '../../space/client/web3/dao-space-factory/get-withdrawn-proposals-by-space';
import { getSpaceVisibility } from '../../space/client/web3/dao-space-factory/get-space-visibility';
import { getDelegatesForSpace } from '../../space/client/web3/dao-space-factory/get-delegates-for-space';
import { getDelegators } from '../../space/client/web3/dao-space-factory/get-delegators';
import { isMember as isMemberConfig } from '../../space/client/web3/dao-space-factory/is-member';
import { getSpaceDetails } from '../../space/shared/web3/get-space-details';
import { getMemberSpaces } from '../../space/client/web3/dao-space-factory/get-member-spaces';
import { getSpacesForDelegate } from '../../space/client/web3/dao-space-factory/get-spaces-for-delegate';
import type {
  ProposalCoreValues,
  ProposalOutcomeIds,
} from '../proposal-status';

/**
 * All `/api/v2` chain reads use block tag `latest` (K14), like the Hypha UI list
 * and detail. The older server helpers read at `safe`, which lags `latest`.
 */
const BLOCK_TAG = 'latest' as const;

export type ChainClock = {
  nowSeconds: number;
  /** ISO time `nowSeconds` stands for. */
  asOf: string;
  /** Latest block number, or null when the block read failed (server clock used). */
  asOfBlock: number | null;
};

/** `now` from the latest block (the contract compares `block.timestamp`), else server clock. */
export async function readChainClock(): Promise<ChainClock> {
  try {
    const block = await web3Client.getBlock({ blockTag: BLOCK_TAG });
    const nowSeconds = Number(block.timestamp);
    return {
      nowSeconds,
      asOf: new Date(nowSeconds * 1000).toISOString(),
      asOfBlock: Number(block.number),
    };
  } catch (error) {
    console.error(
      '[api-v2] latest block read failed, using server clock',
      error,
    );
    const now = Date.now();
    return {
      nowSeconds: Math.floor(now / 1000),
      asOf: new Date(now).toISOString(),
      asOfBlock: null,
    };
  }
}

export type SpaceGovernance = {
  quorum: number;
  unity: number;
  votingPowerSource: number;
  joinMethod: number;
  exitMethod: number;
  memberCount: number;
};

type SpaceDetailsTuple = readonly [
  unity: bigint,
  quorum: bigint,
  votingPowerSource: bigint,
  tokenAddresses: readonly `0x${string}`[],
  members: readonly `0x${string}`[],
  exitMethod: bigint,
  joinMethod: bigint,
  ...rest: unknown[],
];

function toGovernance(details: SpaceDetailsTuple): SpaceGovernance {
  const [unity, quorum, votingPowerSource, , members, exitMethod, joinMethod] =
    details;
  return {
    quorum: Number(quorum),
    unity: Number(unity),
    votingPowerSource: Number(votingPowerSource),
    joinMethod: Number(joinMethod),
    exitMethod: Number(exitMethod),
    memberCount: members.length,
  };
}

/** One batched multicall for many spaces; failed reads are omitted from the map. */
export async function readSpaceGovernanceBatch(
  web3SpaceIds: number[],
): Promise<Map<number, SpaceGovernance>> {
  const result = new Map<number, SpaceGovernance>();
  if (web3SpaceIds.length === 0) return result;

  const response = await web3Client.multicall({
    allowFailure: true,
    blockTag: BLOCK_TAG,
    contracts: web3SpaceIds.map((id) =>
      getSpaceDetails({ spaceId: BigInt(id) }),
    ),
  });
  response.forEach((res, i) => {
    if (res.status === 'success' && res.result !== undefined) {
      result.set(
        web3SpaceIds[i]!,
        toGovernance(res.result as unknown as SpaceDetailsTuple),
      );
    }
  });
  return result;
}

export type SpaceVisibility = { discoverability: number; access: number };

type VisibilityRaw =
  | { discoverability: bigint | number; access: bigint | number }
  | readonly [bigint | number, bigint | number];

export async function readSpaceVisibilityBatch(
  web3SpaceIds: number[],
): Promise<Map<number, SpaceVisibility>> {
  const result = new Map<number, SpaceVisibility>();
  if (web3SpaceIds.length === 0) return result;

  const response = await web3Client.multicall({
    allowFailure: true,
    blockTag: BLOCK_TAG,
    contracts: web3SpaceIds.map((id) =>
      getSpaceVisibility({ spaceId: BigInt(id) }),
    ),
  });
  response.forEach((res, i) => {
    if (res.status !== 'success' || res.result === undefined) return;
    const v = res.result as unknown as VisibilityRaw;
    result.set(web3SpaceIds[i]!, {
      discoverability: Number(
        'discoverability' in v ? v.discoverability : v[0],
      ),
      access: Number('access' in v ? v.access : v[1]),
    });
  });
  return result;
}

/** Accepted / rejected / withdrawn id sets at `latest`. Throws on read failure. */
export async function readProposalOutcomeIds(
  web3SpaceId: number,
): Promise<ProposalOutcomeIds> {
  const spaceId = BigInt(web3SpaceId);
  const [proposals, withdrawn] = await web3Client.multicall({
    allowFailure: false,
    blockTag: BLOCK_TAG,
    contracts: [
      getSpaceProposals({ spaceId }),
      getWithdrawnProposalsBySpace({ spaceId }),
    ],
  });
  const [accepted, rejected] = proposals as unknown as readonly [
    readonly bigint[],
    readonly bigint[],
  ];
  const toSet = (ids: readonly bigint[]) =>
    new Set(ids.map((id) => Number(id)));
  return {
    accepted: toSet(accepted ?? []),
    rejected: toSet(rejected ?? []),
    withdrawn: toSet((withdrawn as unknown as readonly bigint[]) ?? []),
  };
}

type ProposalCoreTuple = readonly [
  spaceId: bigint,
  startTime: bigint,
  endTime: bigint,
  executed: boolean,
  expired: boolean,
  yesVotes: bigint,
  noVotes: bigint,
  totalVotingPowerAtSnapshot: bigint,
  ...rest: unknown[],
];

function toProposalCore(tuple: ProposalCoreTuple): ProposalCoreValues {
  const [
    ,
    startTime,
    endTime,
    executed,
    expired,
    yesVotes,
    noVotes,
    totalVotingPowerAtSnapshot,
  ] = tuple;
  return {
    startTime,
    endTime,
    executed,
    expired,
    yesVotes,
    noVotes,
    totalVotingPowerAtSnapshot,
  };
}

/** `getProposalCore` per id, `transactions[]` dropped. Failed reads are omitted. */
export async function readProposalCoreBatch(
  proposalIds: number[],
): Promise<Map<number, ProposalCoreValues>> {
  const result = new Map<number, ProposalCoreValues>();
  if (proposalIds.length === 0) return result;

  const response = await web3Client.multicall({
    allowFailure: true,
    blockTag: BLOCK_TAG,
    contracts: proposalIds.map((id) =>
      getProposalDetails({ proposalId: BigInt(id) }),
    ),
  });
  response.forEach((res, i) => {
    if (res.status !== 'success' || res.result === undefined) return;
    result.set(
      proposalIds[i]!,
      toProposalCore(res.result as unknown as ProposalCoreTuple),
    );
  });
  return result;
}

export async function readProposalVoters(proposalId: number) {
  const [yesVoters, noVoters] = (await web3Client.readContract({
    ...getProposalVoters({ proposalId: BigInt(proposalId) }),
    blockTag: BLOCK_TAG,
  })) as unknown as readonly [readonly string[], readonly string[]];
  return { yesVoters, noVoters };
}

/**
 * `isMember` is the contract's membership; `isDelegate` means the address is a
 * delegate in the space AND at least one of its delegators is a member (the
 * same rule `vote` enforces via `checkProposalExpiration`).
 */
export async function readMemberAndDelegate(
  web3SpaceId: number,
  address: `0x${string}`,
): Promise<{ isMember: boolean; isDelegate: boolean }> {
  const spaceId = BigInt(web3SpaceId);
  const [member, delegates] = await Promise.all([
    web3Client.readContract({
      ...isMemberConfig({ spaceId, memberAddress: address }),
      blockTag: BLOCK_TAG,
    }),
    web3Client.readContract({
      ...getDelegatesForSpace({ spaceId }),
      blockTag: BLOCK_TAG,
    }),
  ]);
  const listed = (delegates as unknown as readonly string[]).some(
    (d) => d.toLowerCase() === address.toLowerCase(),
  );
  if (!listed) return { isMember: Boolean(member), isDelegate: false };

  const [details, delegators] = await Promise.all([
    web3Client.readContract({
      ...getSpaceDetails({ spaceId }),
      blockTag: BLOCK_TAG,
    }),
    web3Client.readContract({
      ...getDelegators({ user: address, spaceId }),
      blockTag: BLOCK_TAG,
    }),
  ]);
  const members = new Set(
    (details as unknown as SpaceDetailsTuple)[4].map((m) => m?.toLowerCase()),
  );
  const isDelegate = (delegators as unknown as readonly string[]).some((d) =>
    members.has(d?.toLowerCase()),
  );
  return { isMember: Boolean(member), isDelegate };
}

/** `isProposalWithdrawn(id)`; voting/me needs one proposal, not a space-wide list. */
export async function readIsProposalWithdrawn(
  proposalId: number,
): Promise<boolean> {
  return Boolean(
    await web3Client.readContract({
      address: daoProposalsImplementationAddress[8453],
      abi: daoProposalsImplementationAbi,
      functionName: 'isProposalWithdrawn',
      args: [BigInt(proposalId)],
      blockTag: BLOCK_TAG,
    }),
  );
}

/** Space ids the address is a member of (one view call). Throws on failure. */
export async function readMemberSpaceIds(
  address: `0x${string}`,
): Promise<number[]> {
  const ids = (await web3Client.readContract({
    ...getMemberSpaces({ memberAddress: address }),
    blockTag: BLOCK_TAG,
  })) as unknown as readonly bigint[];
  return ids.map((id) => Number(id));
}

/** Space ids the address is LISTED as a delegate in (not yet validated). */
export async function readDelegateSpaceIds(
  address: `0x${string}`,
): Promise<number[]> {
  const ids = (await web3Client.readContract({
    ...getSpacesForDelegate({ user: address }),
    blockTag: BLOCK_TAG,
  })) as unknown as readonly bigint[];
  return ids.map((id) => Number(id));
}

export type SpaceMembersAndExecutor = {
  members: string[];
  executor: string;
};

/** Members (lowercase) and executor (lowercase) per space; failed reads omitted. */
export async function readSpaceMembersBatch(
  web3SpaceIds: number[],
): Promise<Map<number, SpaceMembersAndExecutor>> {
  const result = new Map<number, SpaceMembersAndExecutor>();
  if (web3SpaceIds.length === 0) return result;

  const response = await web3Client.multicall({
    allowFailure: true,
    blockTag: BLOCK_TAG,
    contracts: web3SpaceIds.map((id) =>
      getSpaceDetails({ spaceId: BigInt(id) }),
    ),
  });
  response.forEach((res, i) => {
    if (res.status !== 'success' || res.result === undefined) return;
    const details = res.result as unknown as SpaceDetailsTuple;
    result.set(web3SpaceIds[i]!, {
      members: details[4].map((m) => String(m).toLowerCase()),
      executor: String((details as readonly unknown[])[9] ?? '').toLowerCase(),
    });
  });
  return result;
}

/** Delegators (lowercase) of `address` per space; failed reads omitted. */
export async function readDelegatorsBatch(
  address: `0x${string}`,
  web3SpaceIds: number[],
): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  if (web3SpaceIds.length === 0) return result;

  const response = await web3Client.multicall({
    allowFailure: true,
    blockTag: BLOCK_TAG,
    contracts: web3SpaceIds.map((id) =>
      getDelegators({ user: address, spaceId: BigInt(id) }),
    ),
  });
  response.forEach((res, i) => {
    if (res.status !== 'success' || res.result === undefined) return;
    result.set(
      web3SpaceIds[i]!,
      (res.result as unknown as readonly string[]).map((d) => d.toLowerCase()),
    );
  });
  return result;
}
