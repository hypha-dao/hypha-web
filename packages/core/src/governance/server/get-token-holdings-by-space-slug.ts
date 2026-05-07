import 'server-only';

import { and, eq } from 'drizzle-orm';
import { erc20Abi, formatUnits, isAddress } from 'viem';

import type { DbConfig } from '../../server';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import { findSpaceHostFieldsBySlug } from '../../space/server/queries';
import { computeSpaceMemberEntries } from '../../space/server/get-space-members-roster';
import { fetchSpaceDetails } from '../../space/client/web3/fetch/fetchSpaceDetails';
import { web3Client } from '../../common/server/web3-rpc/client';
import { tokens } from '@hypha-platform/storage-postgres';

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
    };

type HolderDescriptor = {
  address: `0x${string}`;
  holder_kind: Exclude<HolderKind, 'other'>;
  display_name: string;
  slug: string | null;
};

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

  const contracts = holders.map((holder) => ({
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

  const balances = new Map<`0x${string}`, bigint>();
  results.forEach((result, index) => {
    const address = holders[index]?.address;
    if (!address) return;
    balances.set(
      address,
      result.status === 'success' ? (result.result as bigint) : 0n,
    );
  });
  return balances;
}

export async function getTokenHoldingsBySpaceSlug(
  {
    spaceSlug,
    includeZeroBalances = false,
    holderLimit,
    includeTreasury = true,
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
    .select({
      id: tokens.id,
      name: tokens.name,
      symbol: tokens.symbol,
      maxSupply: tokens.maxSupply,
      type: tokens.type,
      iconUrl: tokens.iconUrl,
      address: tokens.address,
      archived: tokens.archived,
    })
    .from(tokens)
    .where(and(eq(tokens.spaceId, host.id), eq(tokens.archived, false)));

  const dbTokenByAddress = new Map<`0x${string}`, (typeof dbTokens)[number]>();
  for (const dbToken of dbTokens) {
    if (!dbToken.address || !isAddress(dbToken.address)) continue;
    dbTokenByAddress.set(normalizeAddress(dbToken.address), dbToken);
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

  if (tokenAddresses.length === 0) {
    tokenAddresses = Array.from(dbTokenByAddress.keys());
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

  const holderDescriptors = Array.from(holderMap.values());

  const tokenRows = await Promise.all(
    tokenAddresses.map(async (tokenAddress) => {
      const contractInfo = await readTokenContractInfo(tokenAddress);
      const tokenMeta = dbTokenByAddress.get(tokenAddress);
      const decimals = contractInfo.decimals;
      const totalSupplyRaw = contractInfo.totalSupplyRaw;

      const balancesByAddress = await readBalancesForHolders(
        tokenAddress,
        holderDescriptors,
      );

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

      for (const descriptor of holderDescriptors) {
        const balanceRaw = balancesByAddress.get(descriptor.address) ?? 0n;
        if (!includeZeroBalances && balanceRaw <= 0n) continue;

        if (descriptor.holder_kind === 'treasury') {
          rows.push({
            holder_kind: 'treasury',
            address: descriptor.address,
            display_name: 'Treasury',
            slug: null,
            balance: formatUnits(balanceRaw, decimals),
            balance_raw: balanceRaw.toString(),
            share_pct: toSharePct(balanceRaw, totalSupplyRaw),
          });
          continue;
        }

        const sharePct = toSharePct(balanceRaw, totalSupplyRaw);
        if (sharePct < 3) {
          collapsedSmallHolderRaw += balanceRaw;
          continue;
        }

        rows.push({
          holder_kind: descriptor.holder_kind,
          address: descriptor.address,
          display_name: descriptor.display_name,
          slug: descriptor.slug,
          balance: formatUnits(balanceRaw, decimals),
          balance_raw: balanceRaw.toString(),
          share_pct: sharePct,
        });
      }

      rows.sort((a, b) => {
        const diff = BigInt(b.balance_raw) - BigInt(a.balance_raw);
        if (diff > 0n) return 1;
        if (diff < 0n) return -1;
        return a.display_name.localeCompare(b.display_name);
      });

      let holderRows = rows;
      let overflowToOtherRaw = 0n;
      if (safeHolderLimit && holderRows.length > safeHolderLimit) {
        const keep = holderRows.slice(0, safeHolderLimit);
        const overflow = holderRows.slice(safeHolderLimit);
        overflowToOtherRaw = overflow.reduce(
          (sum, row) => sum + BigInt(row.balance_raw),
          0n,
        );
        holderRows = keep;
      }

      const otherRaw =
        externalOtherRaw + collapsedSmallHolderRaw + overflowToOtherRaw;
      if (otherRaw > 0n || includeZeroBalances) {
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
        token_id: tokenMeta?.id ?? null,
        token_address: tokenAddress,
        name: tokenMeta?.name ?? contractInfo.name,
        symbol: tokenMeta?.symbol ?? contractInfo.symbol,
        icon_url: tokenMeta?.iconUrl ?? null,
        type: tokenMeta?.type ?? 'unknown',
        decimals,
        max_supply: tokenMeta?.maxSupply ?? null,
        total_supply: formatUnits(totalSupplyRaw, decimals),
        holdings: holderRows,
        treasury_balance: formatUnits(treasuryRaw, decimals),
        other_balance: formatUnits(otherRaw, decimals),
        total_holders_balance: formatUnits(totalSupplyRaw, decimals),
      } satisfies TokenHoldingRow;
    }),
  );

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
    },
  };
}
