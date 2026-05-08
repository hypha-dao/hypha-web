import { NextRequest, NextResponse } from 'next/server';
import { formatUnits, isAddress, parseAbiItem } from 'viem';

import {
  findSpaceBySlug,
  getSpaceMembersRoster,
  getTokenHoldingsBySpaceSlug,
  web3Client,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { checkSpaceAccess } from '@web/utils/check-space-access';

type Params = { spaceSlug: string };

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);
const APPROX_BLOCKS_PER_DAY = 43_200n;
const WINDOW_FALLBACK_DAYS = [365, 180, 90, 30] as const;

function parseIntParam(
  url: URL,
  keys: string | string[],
  fallback: number,
  min: number,
  max: number,
): number {
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const key of keyList) {
    const raw = url.searchParams.get(key);
    if (raw == null || raw === '') continue;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) continue;
    return Math.max(min, Math.min(max, parsed));
  }
  return fallback;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function toMemberLabel(
  member:
    | {
        member_kind: 'person';
        person: {
          name?: string | null;
          surname?: string | null;
          nickname?: string | null;
          slug?: string | null;
          address?: string | null;
        };
      }
    | {
        member_kind: 'space';
        space: {
          title?: string | null;
          slug?: string | null;
          address?: string | null;
        };
      },
): string {
  if (member.member_kind === 'person') {
    const fullName = `${member.person.name ?? ''} ${
      member.person.surname ?? ''
    }`.trim();
    return (
      fullName ||
      member.person.nickname ||
      member.person.slug ||
      shortAddress(member.person.address ?? '')
    );
  }
  return (
    member.space.title ||
    member.space.slug ||
    shortAddress(member.space.address ?? '')
  );
}

async function fetchTransferLogs(tokenAddress: `0x${string}`) {
  const latestBlock = await web3Client.getBlockNumber();
  for (const windowDays of WINDOW_FALLBACK_DAYS) {
    try {
      const span = BigInt(windowDays) * APPROX_BLOCKS_PER_DAY;
      const fromBlock = latestBlock > span ? latestBlock - span : 0n;
      const logs = await web3Client.getLogs({
        address: tokenAddress,
        event: TRANSFER_EVENT,
        fromBlock,
        toBlock: 'latest',
      });
      return { logs, windowDays };
    } catch {
      continue;
    }
  }
  return { logs: [], windowDays: WINDOW_FALLBACK_DAYS.at(-1) ?? 30 };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (space.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
      const { hasAccess, response } = await checkSpaceAccess(
        request,
        space.web3SpaceId as number,
      );
      if (!hasAccess && response) {
        return response;
      }
    }

    const authHeader = request.headers.get('authorization');
    const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
    const bearer = bearerMatch?.[1]?.trim() || undefined;

    const tokenHoldings = await getTokenHoldingsBySpaceSlug(
      { spaceSlug, includeTreasury: true, collapseBelowPct: 1 },
      { db, authToken: bearer },
    );
    if (tokenHoldings.access === 'denied') {
      return NextResponse.json(
        { error: tokenHoldings.message },
        { status: tokenHoldings.httpStatus },
      );
    }
    if (
      !tokenHoldings.result.found ||
      tokenHoldings.result.tokens.length === 0
    ) {
      return NextResponse.json({
        found: true,
        space_slug: spaceSlug,
        asOf: new Date().toISOString(),
        window_days: 0,
        token: null,
        members: [{ id: 'all', label: 'All' }],
        points: [],
      });
    }

    const url = new URL(request.url);
    const requestedToken = url.searchParams.get('token_address')?.toLowerCase();
    const requestedMember =
      url.searchParams.get('member')?.toLowerCase() ?? 'all';
    const maxPoints = parseIntParam(url, 'max_points', 180, 30, 365);

    const utilityToken = tokenHoldings.result.tokens.find((token) =>
      token.type.toLowerCase().includes('utility'),
    );
    const selectedToken =
      tokenHoldings.result.tokens.find(
        (token) => token.token_address.toLowerCase() === requestedToken,
      ) ??
      utilityToken ??
      tokenHoldings.result.tokens[0]!;
    const tokenAddress =
      selectedToken.token_address.toLowerCase() as `0x${string}`;

    const membersByAddress = new Map<string, { id: string; label: string }>();
    let page = 1;
    while (true) {
      const roster = await getSpaceMembersRoster(
        { spaceSlug, page, pageSize: 100 },
        { db },
      );
      if (!roster.found) break;

      for (const member of roster.members) {
        const rawAddress =
          member.member_kind === 'person'
            ? member.person.address
            : member.space.address;
        if (!rawAddress || !isAddress(rawAddress)) continue;
        const normalized = rawAddress.toLowerCase();
        if (membersByAddress.has(normalized)) continue;
        membersByAddress.set(normalized, {
          id: normalized,
          label: toMemberLabel(member),
        });
      }

      if (!roster.pagination.has_next_page) break;
      page += 1;
    }

    const members = [
      { id: 'all', label: 'All' },
      ...Array.from(membersByAddress.values()).sort((a, b) =>
        a.label.localeCompare(b.label),
      ),
    ];

    const selectedMember =
      requestedMember !== 'all' && membersByAddress.has(requestedMember)
        ? requestedMember
        : 'all';
    const trackedAddressSet = new Set(membersByAddress.keys());

    const { logs, windowDays } = await fetchTransferLogs(tokenAddress);
    const blockNumbers = Array.from(
      new Set(logs.map((log) => log.blockNumber).filter(Boolean)),
    );
    const blockToTimestamp = new Map<bigint, number>();
    await Promise.all(
      blockNumbers.map(async (blockNumber) => {
        const block = await web3Client.getBlock({ blockNumber });
        blockToTimestamp.set(blockNumber, Number(block.timestamp) * 1000);
      }),
    );

    const amountByDay = new Map<string, number>();
    for (const log of logs) {
      const to = log.args.to?.toLowerCase();
      const value = log.args.value;
      const blockNumber = log.blockNumber;
      if (!to || value == null || value <= 0n || blockNumber == null) continue;

      const includeRecipient =
        selectedMember === 'all'
          ? trackedAddressSet.has(to)
          : to === selectedMember;
      if (!includeRecipient) continue;

      const timestampMs = blockToTimestamp.get(blockNumber);
      if (!timestampMs) continue;
      const dayKey = new Date(timestampMs).toISOString().slice(0, 10);
      const amount = Number.parseFloat(
        formatUnits(value, selectedToken.decimals),
      );
      if (!Number.isFinite(amount) || amount <= 0) continue;
      amountByDay.set(dayKey, (amountByDay.get(dayKey) ?? 0) + amount);
    }

    const orderedDays = Array.from(amountByDay.keys()).sort();
    const totalSupply = Number.parseFloat(selectedToken.total_supply);
    let cumulative = 0;
    const points = orderedDays
      .map((dayKey) => {
        cumulative += amountByDay.get(dayKey) ?? 0;
        return {
          date: dayKey,
          cumulative_amount: cumulative,
          share_pct:
            Number.isFinite(totalSupply) && totalSupply > 0
              ? (cumulative / totalSupply) * 100
              : 0,
        };
      })
      .slice(-maxPoints);

    return NextResponse.json({
      found: true,
      space_slug: spaceSlug,
      asOf: new Date().toISOString(),
      window_days: windowDays,
      token: {
        token_address: selectedToken.token_address,
        symbol: selectedToken.symbol,
        name: selectedToken.name,
        type: selectedToken.type,
      },
      members,
      points,
    });
  } catch (error) {
    console.error('Failed to fetch token distribution history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token distribution history' },
      { status: 500 },
    );
  }
}
