import 'server-only';

import { and, eq, or, sql } from 'drizzle-orm';
import { erc20Abi, formatUnits, isAddress } from 'viem';

import type { DbConfig } from '../../server';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import { findPeopleByWeb3Addresses } from '../../people/server/queries';
import { getErc20HolderAddresses } from '../../common/server/get-erc20-holder-addresses';
import {
  findParentSpaceById,
  findSpaceHostFieldsBySlug,
  findSpaceByAddresses,
} from '../../space/server/queries';
import { computeSpaceMemberEntries } from '../../space/server/get-space-members-roster';
import { fetchSpaceDetails } from '../../space/client/web3/fetch/fetchSpaceDetails';
import { web3Client } from '../../common/server/web3-rpc/client';
import {
  isEpartsToken,
  isHiddenToken,
  isHyphaToken,
} from '../../common/web3/tokens';
import { tokens } from '@hypha-platform/storage-postgres';
import {
  extraSharedDistributionTokenAddresses,
  shouldIncludeParentOwnershipTokens,
} from '../distribution-shared-tokens';
import {
  compareByBalanceThenAddress,
  shouldIncludeChartOtherBucket,
} from '../distribution-chart-holders';

type HolderKind = 'person' | 'space' | 'treasury' | 'other';

type HolderRow = {
  holder_kind: HolderKind;
  address: `0x${string}` | null;
  display_name: string;
  slug: string | null;
  balance: string;
  balance_raw: string;
  share_pct: number;
};

type TokenHoldingRow = {
  token_id: number | null;
  token_address: `0x${string}`;
  name: string;
  symbol: string;
  icon_url: string | null;
  type: string;
  decimals: number;
  max_supply: string | number | null;
  total_supply: string;
  holdings: HolderRow[];
  treasury_balance: string;
  other_balance: string;
  total_holders_balance: string;
};

export type GetTokenHoldingsBySpaceSlugInput = {
  spaceSlug: string;
  includeZeroBalances?: boolean;
  holderLimit?: number;
  includeTreasury?: boolean;
  collapseBelowPct?: number;
  /** Enumerate unnamed wallets instead of collapsing them into Other. */
  expandUnknownHolders?: boolean;
};

export type GetTokenHoldingsBySpaceSlugResult =
  | {
      found: false;
      space_slug: string;
      space: null;
      source: 'db+chain';
      asOf: string;
      tokens: [];
    }
  | {
      found: true;
      space_slug: string;
      space: {
        id: number;
        slug: string;
        title: string;
        parent_id: number | null;
        web3_space_id: number | null;
      };
      source: 'db+chain';
      asOf: string;
      tokens: TokenHoldingRow[];
      holders_complete: boolean;
    };

type HolderDescriptor = {
  address: `0x${string}`;
  holder_kind: HolderKind;
  display_name: string;
  slug: string | null;
};

const BALANCE_MULTICALL_CHUNK_SIZE = 200;
const BALANCE_MULTICALL_CONCURRENCY = 8;
const TOKEN_PROCESS_CONCURRENCY = 4;
const TOKEN_META_COLUMNS = {
  id: tokens.id,
  name: tokens.name,
  symbol: tokens.symbol,
  maxSupply: tokens.maxSupply,
  type: tokens.type,
  iconUrl: tokens.iconUrl,
  address: tokens.address,
  archived: tokens.archived,
} as const;

function normalizeAddress(address: string): `0x${string}` {
  return address.toLowerCase() as `0x${string}`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function toSharePct(value: bigint, total: bigint): number {
  if (total <= 0n || value <= 0n) return 0;
  const basisPoints = (value * 10_000n) / total;
  return Number(basisPoints) / 100;
}

function ensureNonNegativeBigInt(value: bigint): bigint {
  return value > 0n ? value : 0n;
}

function resolvePersonDisplayName(entry: {
  person: {
    name?: string;
    surname?: string;
    nickname?: string;
    slug?: string;
    address?: string;
  };
}): string {
  const fullName = `${entry.person.name ?? ''} ${
    entry.person.surname ?? ''
  }`.trim();
  return (
    fullName ||
    entry.person.nickname ||
    entry.person.slug ||
    shortAddress(entry.person.address ?? '')
  );
}

function dedupeAddresses(addresses: readonly `0x${string}`[]): `0x${string}`[] {
  return Array.from(
    new Set(addresses.map((address) => normalizeAddress(address))),
  );
}

function isVoiceTokenSymbol(symbol: string): boolean {
  const normalized = symbol.trim().toUpperCase();
  return normalized === 'HVOICE' || normalized === 'EVOICE';
}

async function readTokenContractInfo(tokenAddress: `0x${string}`): Promise<{
  decimals: number;
  symbol: string;
  name: string;
  totalSupplyRaw: bigint;
}> {
  const contracts = [
    {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'decimals',
      args: [],
    },
    { address: tokenAddress, abi: erc20Abi, functionName: 'symbol', args: [] },
    { address: tokenAddress, abi: erc20Abi, functionName: 'name', args: [] },
    {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'totalSupply',
      args: [],
    },
  ] as const;

  const [decimalsRes, symbolRes, nameRes, totalSupplyRes] =
    await web3Client.multicall({
      allowFailure: true,
      blockTag: 'safe',
      contracts,
    });

  return {
    decimals:
      decimalsRes.status === 'success' ? Number(decimalsRes.result) : 18,
    symbol: symbolRes.status === 'success' ? symbolRes.result : 'UNKNOWN',
    name: nameRes.status === 'success' ? nameRes.result : 'Unnamed',
    totalSupplyRaw:
      totalSupplyRes.status === 'success' ? totalSupplyRes.result : 0n,
  };
}

async function readBalancesForHolders(
  tokenAddress: `0x${string}`,
  holders: HolderDescriptor[],
): Promise<Map<`0x${string}`, bigint>> {
  if (holders.length === 0) return new Map();
  const balances = new Map<`0x${string}`, bigint>();
  const chunks: HolderDescriptor[][] = [];
  for (
    let startIndex = 0;
    startIndex < holders.length;
    startIndex += BALANCE_MULTICALL_CHUNK_SIZE
  ) {
    chunks.push(
      holders.slice(startIndex, startIndex + BALANCE_MULTICALL_CHUNK_SIZE),
    );
  }

  const readChunk = async (holderChunk: HolderDescriptor[]) => {
    const contracts = holderChunk.map((holder) => ({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [holder.address] as const,
    }));
    const results = await web3Client.multicall({
      allowFailure: true,
      blockTag: 'safe',
      contracts,
    });
    return { holderChunk, results };
  };

  for (
    let startIndex = 0;
    startIndex < chunks.length;
    startIndex += BALANCE_MULTICALL_CONCURRENCY
  ) {
    const batch = chunks.slice(
      startIndex,
      startIndex + BALANCE_MULTICALL_CONCURRENCY,
    );
    const batchResults = await Promise.all(batch.map(readChunk));
    for (const { holderChunk, results } of batchResults) {
      results.forEach((result, index) => {
        const address = holderChunk[index]?.address;
        if (!address) return;
        balances.set(
          address,
          result.status === 'success' ? (result.result as bigint) : 0n,
        );
      });
    }
  }

  return balances;
}

function attachPlaceholderHolders(
  holdersByAddress: Map<`0x${string}`, HolderDescriptor>,
  addresses: readonly `0x${string}`[],
) {
  for (const address of addresses) {
    if (holdersByAddress.has(address)) continue;
    holdersByAddress.set(address, {
      address,
      holder_kind: 'other',
      display_name: '',
      slug: null,
    });
  }
}

async function resolveHolderIdentities(
  holders: HolderDescriptor[],
  db: DbConfig['db'],
): Promise<void> {
  const unnamed = holders.filter(
    (holder) => holder.address && !holder.display_name,
  );
  if (unnamed.length === 0) return;

  const unknownAddresses = unnamed.map((holder) => holder.address);
  const [people, spacesResult] = await Promise.all([
    findPeopleByWeb3Addresses({ addresses: unknownAddresses }, { db }),
    findSpaceByAddresses(unknownAddresses, {}, { db }),
  ]);

  const peopleByAddress = new Map(
    people
      .filter((person) => person.address && isAddress(person.address))
      .map((person) => [normalizeAddress(person.address!), person]),
  );
  const spacesByAddress = new Map(
    spacesResult.data
      .filter((space) => space.address && isAddress(space.address))
      .map((space) => [normalizeAddress(space.address!), space]),
  );

  for (const holder of unnamed) {
    const person = peopleByAddress.get(holder.address);
    if (person) {
      holder.holder_kind = 'person';
      holder.display_name = resolvePersonDisplayName({ person });
      holder.slug = person.slug ?? null;
      continue;
    }

    const space = spacesByAddress.get(holder.address);
    if (space) {
      holder.holder_kind = 'space';
      holder.display_name =
        space.title || space.slug || shortAddress(holder.address);
      holder.slug = space.slug ?? null;
    }
  }
}

async function withDiscoveredHolders(
  tokenAddress: `0x${string}`,
  knownHolders: HolderDescriptor[],
  db: DbConfig['db'],
  options: { resolveNames?: boolean } = {},
): Promise<{ holders: HolderDescriptor[]; complete: boolean }> {
  const resolveNames = options.resolveNames !== false;
  const holdersByAddress = new Map(
    knownHolders.map((holder) => [holder.address, holder]),
  );

  let discovered: `0x${string}`[] = [];
  let complete = true;
  try {
    const discovery = await getErc20HolderAddresses(tokenAddress);
    discovered = discovery.addresses;
    complete = discovery.complete;
  } catch (error) {
    console.warn(
      `[getTokenHoldingsBySpaceSlug] failed to enumerate holders for ${tokenAddress}`,
      error,
    );
    return { holders: knownHolders, complete: false };
  }

  const unknownAddresses = discovered.filter(
    (address) => !holdersByAddress.has(address),
  );
  if (unknownAddresses.length === 0) {
    return { holders: knownHolders, complete };
  }

  attachPlaceholderHolders(holdersByAddress, unknownAddresses);
  const holders = Array.from(holdersByAddress.values());
  if (resolveNames) {
    await resolveHolderIdentities(holders, db);
  }

  return { holders, complete };
}

export async function getTokenHoldingsBySpaceSlug(
  {
    spaceSlug,
    includeZeroBalances = false,
    holderLimit,
    includeTreasury = true,
    collapseBelowPct,
    expandUnknownHolders = false,
  }: GetTokenHoldingsBySpaceSlugInput,
  { db, authToken }: DbConfig & { authToken?: string },
): Promise<
  | { access: 'ok'; result: GetTokenHoldingsBySpaceSlugResult }
  | {
      access: 'denied';
      message: string;
      space_slug: string;
      httpStatus: 401 | 403 | 500;
    }
> {
  const asOf = new Date().toISOString();
  const safeHolderLimit =
    typeof holderLimit === 'number' && Number.isFinite(holderLimit)
      ? Math.max(1, Math.min(1000, Math.floor(holderLimit)))
      : undefined;
  // Default 0.5%: keep small-but-named holders visible; callers can raise
  // collapse or set holderLimit to keep the long tail in "Other".
  const safeCollapseBelowPct =
    typeof collapseBelowPct === 'number' && Number.isFinite(collapseBelowPct)
      ? Math.max(0, Math.min(100, collapseBelowPct))
      : 0.5;

  const host = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
  if (!host) {
    return {
      access: 'ok',
      result: {
        found: false,
        space_slug: spaceSlug,
        space: null,
        source: 'db+chain',
        asOf,
        tokens: [],
      },
    };
  }

  if (host.web3SpaceId != null) {
    const gate = await checkSpaceAccessForSpace(host, authToken);
    if (!gate.hasAccess) {
      return {
        access: 'denied',
        message: gate.message,
        space_slug: spaceSlug,
        httpStatus: gate.httpStatus,
      };
    }
  }

  const dbTokens = await db
    .select(TOKEN_META_COLUMNS)
    .from(tokens)
    .where(and(eq(tokens.spaceId, host.id), eq(tokens.archived, false)));

  let parentOwnershipTokens: typeof dbTokens = [];
  let parentAccess: { hasAccess: boolean } | null = null;
  if (host.parentId != null) {
    const parent = await findParentSpaceById({ id: host.parentId }, { db });
    parentAccess = parent
      ? await checkSpaceAccessForSpace(
          { id: parent.id, web3SpaceId: parent.web3SpaceId },
          authToken,
        )
      : null;
    if (shouldIncludeParentOwnershipTokens(parentAccess)) {
      parentOwnershipTokens = await db
        .select(TOKEN_META_COLUMNS)
        .from(tokens)
        .where(
          and(
            eq(tokens.spaceId, host.parentId),
            eq(tokens.archived, false),
            eq(tokens.type, 'ownership'),
          ),
        );
    }
  }

  const dbTokenByAddress = new Map<`0x${string}`, (typeof dbTokens)[number]>();
  for (const dbToken of [...dbTokens, ...parentOwnershipTokens]) {
    if (!dbToken.address || !isAddress(dbToken.address)) continue;
    const address = normalizeAddress(dbToken.address);
    if (!dbTokenByAddress.has(address)) {
      dbTokenByAddress.set(address, dbToken);
    }
  }

  let tokenAddresses: `0x${string}`[] = [];
  let treasuryAddress: `0x${string}` | null = null;
  if (host.web3SpaceId != null) {
    try {
      const details = await fetchSpaceDetails({
        spaceIds: [BigInt(host.web3SpaceId)],
        allowFailure: true,
      });
      const first = details[0];
      if (first) {
        tokenAddresses = dedupeAddresses(first.tokenAddresses);
        treasuryAddress = normalizeAddress(first.executor);
      }
    } catch (error) {
      console.warn(
        `[getTokenHoldingsBySpaceSlug] failed to fetch on-chain details for "${spaceSlug}"`,
        error,
      );
    }
  }

  tokenAddresses = dedupeAddresses([
    ...tokenAddresses,
    ...Array.from(dbTokenByAddress.keys()),
    ...extraSharedDistributionTokenAddresses({
      spaceSlug: host.slug,
      spaceTitle: host.title,
      spaceId: host.id,
      parentId: host.parentId,
      parentAccess,
    }).map((address) => normalizeAddress(address)),
  ]);

  // Drop retired/hidden tokens so they never appear in holder breakdowns.
  tokenAddresses = tokenAddresses.filter((address) => !isHiddenToken(address));

  const missingMetaAddresses = tokenAddresses.filter(
    (address) => !dbTokenByAddress.has(address),
  );
  if (missingMetaAddresses.length > 0) {
    const extraTokens = await db
      .select(TOKEN_META_COLUMNS)
      .from(tokens)
      .where(
        and(
          eq(tokens.archived, false),
          or(
            ...missingMetaAddresses.map(
              (address) => sql`lower(${tokens.address}) = ${address}`,
            ),
          ),
        ),
      );
    for (const extra of extraTokens) {
      if (!extra.address || !isAddress(extra.address)) continue;
      const address = normalizeAddress(extra.address);
      if (!dbTokenByAddress.has(address)) {
        dbTokenByAddress.set(address, extra);
      }
    }
  }

  const computedRoster = await computeSpaceMemberEntries(spaceSlug, { db });
  const holderMap = new Map<`0x${string}`, HolderDescriptor>();

  if (computedRoster.found) {
    for (const entry of computedRoster.entries) {
      if (entry.member_kind === 'person') {
        const rawAddress = entry.person.address;
        if (!rawAddress || !isAddress(rawAddress)) continue;
        const address = normalizeAddress(rawAddress);
        holderMap.set(address, {
          address,
          holder_kind: 'person',
          display_name: resolvePersonDisplayName(entry),
          slug: entry.person.slug ?? null,
        });
      } else {
        const rawAddress = entry.space.address;
        if (!rawAddress || !isAddress(rawAddress)) continue;
        const address = normalizeAddress(rawAddress);
        holderMap.set(address, {
          address,
          holder_kind: 'space',
          display_name:
            entry.space.title || entry.space.slug || shortAddress(address),
          slug: entry.space.slug ?? null,
        });
      }
    }
  }

  if (includeTreasury && treasuryAddress) {
    holderMap.set(treasuryAddress, {
      address: treasuryAddress,
      holder_kind: 'treasury',
      display_name: 'Treasury',
      slug: null,
    });
  }

  const rosterHolders = Array.from(holderMap.values());
  const expandHolders = expandUnknownHolders === true;
  const effectiveCollapseBelowPct = expandHolders ? 0 : safeCollapseBelowPct;
  const effectiveHolderLimit = safeHolderLimit;
  const includeOtherBucket = shouldIncludeChartOtherBucket({
    expandUnknownHolders: expandHolders,
    holderLimit: effectiveHolderLimit,
  });

  const buildTokenRow = async (
    tokenAddress: `0x${string}`,
  ): Promise<{ row: TokenHoldingRow; holdersComplete: boolean }> => {
    const contractInfo = await readTokenContractInfo(tokenAddress);
    const tokenMeta = dbTokenByAddress.get(tokenAddress);
    const isHyphaSharedToken = isHyphaToken(tokenAddress);
    const isEpartsSharedToken = isEpartsToken(tokenAddress);
    const isVoiceToken =
      tokenMeta?.type === 'voice' || isVoiceTokenSymbol(contractInfo.symbol);
    const decimals = contractInfo.decimals;
    const totalSupplyRaw = contractInfo.totalSupplyRaw;

    let holdersComplete = true;
    let holderDescriptors = rosterHolders;
    if (expandHolders) {
      const discovered = await withDiscoveredHolders(
        tokenAddress,
        rosterHolders,
        db,
        { resolveNames: false },
      );
      holderDescriptors = discovered.holders;
      holdersComplete = discovered.complete;
    }

    const balancesByAddress = await readBalancesForHolders(
      tokenAddress,
      holderDescriptors,
    );

    if (expandHolders) {
      const rankedForNames = [...holderDescriptors]
        .filter((descriptor) => {
          const balanceRaw = balancesByAddress.get(descriptor.address) ?? 0n;
          return includeZeroBalances || balanceRaw > 0n;
        })
        .sort((left, right) =>
          compareByBalanceThenAddress(
            balancesByAddress.get(left.address) ?? 0n,
            left.address,
            balancesByAddress.get(right.address) ?? 0n,
            right.address,
          ),
        );
      const nameResolveHolders = effectiveHolderLimit
        ? rankedForNames.slice(0, effectiveHolderLimit)
        : rankedForNames;
      await resolveHolderIdentities(nameResolveHolders, db);
    }

    const treasuryDescriptor = holderDescriptors.find(
      (holder) => holder.holder_kind === 'treasury',
    );
    const treasuryRaw =
      treasuryDescriptor && balancesByAddress.has(treasuryDescriptor.address)
        ? balancesByAddress.get(treasuryDescriptor.address) ?? 0n
        : 0n;

    let knownBalancesRaw = 0n;
    for (const value of balancesByAddress.values()) {
      knownBalancesRaw += value;
    }
    const externalOtherRaw = ensureNonNegativeBigInt(
      totalSupplyRaw - knownBalancesRaw,
    );

    let collapsedSmallHolderRaw = 0n;
    const rows: HolderRow[] = [];

    const aggregatedMembers = new Map<
      string,
      {
        holder_kind: Exclude<HolderKind, 'treasury'>;
        display_name: string;
        slug: string | null;
        address: `0x${string}`;
        balance_raw: bigint;
      }
    >();

    for (const descriptor of holderDescriptors) {
      const balanceRaw = balancesByAddress.get(descriptor.address) ?? 0n;
      if (!includeZeroBalances && balanceRaw <= 0n) continue;

      if (expandHolders || descriptor.holder_kind === 'treasury') {
        rows.push({
          holder_kind: descriptor.holder_kind,
          address: descriptor.address,
          display_name:
            descriptor.display_name ||
            (includeOtherBucket
              ? shortAddress(descriptor.address)
              : descriptor.display_name),
          slug: descriptor.slug,
          balance: formatUnits(balanceRaw, decimals),
          balance_raw: balanceRaw.toString(),
          share_pct: toSharePct(balanceRaw, totalSupplyRaw),
        });
        continue;
      }

      const entityKey =
        descriptor.holder_kind === 'person' ||
        descriptor.holder_kind === 'space'
          ? `${descriptor.holder_kind}:${descriptor.slug ?? descriptor.address}`
          : `${descriptor.holder_kind}:${descriptor.address}`;
      const existing = aggregatedMembers.get(entityKey);
      if (existing) {
        existing.balance_raw += balanceRaw;
      } else {
        aggregatedMembers.set(entityKey, {
          holder_kind: descriptor.holder_kind,
          display_name: descriptor.display_name,
          slug: descriptor.slug,
          address: descriptor.address,
          balance_raw: balanceRaw,
        });
      }
    }

    for (const entry of aggregatedMembers.values()) {
      const sharePct = toSharePct(entry.balance_raw, totalSupplyRaw);
      if (sharePct < effectiveCollapseBelowPct) {
        collapsedSmallHolderRaw += entry.balance_raw;
        continue;
      }

      rows.push({
        holder_kind: entry.holder_kind,
        address: entry.address,
        display_name: entry.display_name,
        slug: entry.slug,
        balance: formatUnits(entry.balance_raw, decimals),
        balance_raw: entry.balance_raw.toString(),
        share_pct: sharePct,
      });
    }

    rows.sort((a, b) =>
      compareByBalanceThenAddress(
        BigInt(a.balance_raw),
        a.address,
        BigInt(b.balance_raw),
        b.address,
      ),
    );

    let holderRows = rows;
    let overflowToOtherRaw = 0n;
    if (effectiveHolderLimit && holderRows.length > effectiveHolderLimit) {
      const keep = holderRows.slice(0, effectiveHolderLimit);
      const overflow = holderRows.slice(effectiveHolderLimit);
      overflowToOtherRaw = overflow.reduce(
        (sum, row) => sum + BigInt(row.balance_raw),
        0n,
      );
      holderRows = keep;
    }

    const otherRaw =
      externalOtherRaw + collapsedSmallHolderRaw + overflowToOtherRaw;
    if (includeOtherBucket && (otherRaw > 0n || includeZeroBalances)) {
      holderRows.push({
        holder_kind: 'other',
        address: null,
        display_name: 'Other',
        slug: null,
        balance: formatUnits(otherRaw, decimals),
        balance_raw: otherRaw.toString(),
        share_pct: toSharePct(otherRaw, totalSupplyRaw),
      });
    }

    return {
      row: {
        token_id: tokenMeta?.id ?? null,
        token_address: tokenAddress,
        name: tokenMeta?.name ?? contractInfo.name,
        symbol: tokenMeta?.symbol ?? contractInfo.symbol,
        icon_url: tokenMeta?.iconUrl ?? null,
        type: isVoiceToken
          ? 'voice'
          : tokenMeta?.type ??
            (isHyphaSharedToken
              ? 'utility'
              : isEpartsSharedToken
              ? 'ownership'
              : 'unknown'),
        decimals,
        max_supply: tokenMeta?.maxSupply ?? null,
        total_supply: formatUnits(totalSupplyRaw, decimals),
        holdings: holderRows,
        treasury_balance: formatUnits(treasuryRaw, decimals),
        other_balance: formatUnits(otherRaw, decimals),
        total_holders_balance: formatUnits(totalSupplyRaw, decimals),
      } satisfies TokenHoldingRow,
      holdersComplete,
    };
  };

  const tokenRows: TokenHoldingRow[] = [];
  let holdersComplete = true;
  for (
    let startIndex = 0;
    startIndex < tokenAddresses.length;
    startIndex += TOKEN_PROCESS_CONCURRENCY
  ) {
    const batch = tokenAddresses.slice(
      startIndex,
      startIndex + TOKEN_PROCESS_CONCURRENCY,
    );
    const batchResults = await Promise.all(
      batch.map((token) => buildTokenRow(token)),
    );
    for (const result of batchResults) {
      tokenRows.push(result.row);
      holdersComplete = holdersComplete && result.holdersComplete;
    }
  }

  return {
    access: 'ok',
    result: {
      found: true,
      space_slug: spaceSlug,
      space: {
        id: host.id,
        slug: host.slug,
        title: host.title,
        parent_id: host.parentId ?? null,
        web3_space_id: host.web3SpaceId ?? null,
      },
      source: 'db+chain',
      asOf,
      tokens: tokenRows,
      holders_complete: holdersComplete,
    },
  };
}
