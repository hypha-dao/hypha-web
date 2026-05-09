import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  getAllCoherences,
  getDocumentsBySpaceSlug,
  getSpaceMembersRoster,
  web3Client,
} from '@hypha-platform/core/server';
import {
  energyDistributionImplementationAddress,
  energyDistributionImplementationAbi,
} from '@hypha-platform/core/generated';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { isAddress, parseAbiItem } from 'viem';

type Params = { spaceSlug: string };

function toIsoIfValid(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isOnVotingStatus(status: string | undefined): boolean {
  return status !== 'accepted' && status !== 'rejected';
}

const ENERGY_CONSUMED_EVENT = parseAbiItem(
  'event EnergyConsumed(address indexed member, uint256 quantity, int256 cashCreditBalance)',
);

function normalizeAddress(address: string): `0x${string}` {
  return address.toLowerCase() as `0x${string}`;
}

function formatMemberDisplayName(input: {
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
  slug?: string | null;
  address: `0x${string}`;
}): string {
  const fullName = `${input.name ?? ''} ${input.surname ?? ''}`.trim();
  if (fullName) return fullName;
  if (input.nickname?.trim()) return input.nickname.trim();
  if (input.slug?.trim()) return input.slug.trim();
  return `${input.address.slice(0, 6)}...${input.address.slice(-4)}`;
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

    const [signals, proposalsResult] = await Promise.all([
      getAllCoherences({
        spaceId: space.id,
        includeArchived: false,
      }),
      getDocumentsBySpaceSlug(
        {
          spaceSlug,
          page: 1,
          pageSize: 120,
          state: 'proposal',
        },
        { db, authToken: bearer },
      ),
    ]);

    if (proposalsResult.access === 'denied') {
      return NextResponse.json(
        { error: proposalsResult.message },
        { status: 403 },
      );
    }

    const proposalCounts = {
      onVoting: 0,
      accepted: 0,
      refused: 0,
    };

    const onVotingProposals = proposalsResult.result.found
      ? proposalsResult.result.documents
          .filter((proposal) => isOnVotingStatus(proposal.status))
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          )
          .slice(0, 12)
          .map((proposal) => ({
            id: proposal.id,
            title:
              proposal.title || proposal.label || `Proposal #${proposal.id}`,
            description: proposal.description ?? '',
            label: proposal.label ?? null,
            status: proposal.status ?? 'onVoting',
            updated_at: proposal.updatedAt,
          }))
      : [];

    if (proposalsResult.result.found) {
      for (const proposal of proposalsResult.result.documents) {
        if (proposal.status === 'accepted') {
          proposalCounts.accepted += 1;
        } else if (proposal.status === 'rejected') {
          proposalCounts.refused += 1;
        } else {
          proposalCounts.onVoting += 1;
        }
      }
    }

    const signalPriorities = Array.from(
      new Set(signals.map((signal) => signal.priority)),
    );
    const signalTypes = Array.from(
      new Set(signals.map((signal) => signal.type)),
    );
    const signalTags = Array.from(
      new Set(signals.flatMap((signal) => signal.tags ?? [])),
    );

    const energyAddress = energyDistributionImplementationAddress[8453];
    const memberConsumptionByAddress = new Map<`0x${string}`, number>();
    let spaceConsumption = 0;
    let spaceProduction = 0;
    let collectiveRows: Array<{ owner: `0x${string}`; quantity: number }> = [];

    try {
      const latestBlock = await web3Client.getBlockNumber();
      const approxBlocksPerDay = 43_200n;
      const lookbackDays = 90n;
      const span = approxBlocksPerDay * lookbackDays;
      const fromBlock = latestBlock > span ? latestBlock - span : 0n;

      const [energyConsumedLogs, collectiveConsumption] = await Promise.all([
        web3Client.getLogs({
          address: energyAddress,
          event: ENERGY_CONSUMED_EVENT,
          fromBlock,
          toBlock: 'latest',
        }),
        web3Client.readContract({
          address: energyAddress,
          abi: energyDistributionImplementationAbi,
          functionName: 'getCollectiveConsumption',
        }),
      ]);

      for (const log of energyConsumedLogs) {
        const member = log.args.member;
        const quantityRaw = log.args.quantity;
        if (!member || quantityRaw == null) continue;
        const address = normalizeAddress(member);
        const quantity = Number(quantityRaw);
        if (!Number.isFinite(quantity) || quantity <= 0) continue;
        memberConsumptionByAddress.set(
          address,
          (memberConsumptionByAddress.get(address) ?? 0) + quantity,
        );
        spaceConsumption += quantity;
      }

      if (Array.isArray(collectiveConsumption)) {
        collectiveRows = collectiveConsumption
          .map((row) => {
            const rowOwner = row.owner;
            const rowQuantity = Number(row.quantity);
            if (!rowOwner || !isAddress(rowOwner)) return null;
            if (!Number.isFinite(rowQuantity) || rowQuantity <= 0) return null;
            return {
              owner: normalizeAddress(rowOwner),
              quantity: rowQuantity,
            };
          })
          .filter((row): row is { owner: `0x${string}`; quantity: number } =>
            Boolean(row),
          );
        spaceProduction = collectiveRows.reduce(
          (sum, row) => sum + row.quantity,
          0,
        );
      }
    } catch (error) {
      console.warn('Energy activity fetch failed:', error);
    }

    const memberNameByAddress = new Map<`0x${string}`, string>();
    let rosterPage = 1;
    while (true) {
      const roster = await getSpaceMembersRoster(
        {
          spaceSlug,
          page: rosterPage,
          pageSize: 100,
        },
        { db },
      );
      if (!roster.found) break;
      for (const member of roster.members) {
        if (member.member_kind !== 'person') continue;
        const addressRaw = member.person.address;
        if (!addressRaw || !isAddress(addressRaw)) continue;
        const address = normalizeAddress(addressRaw);
        memberNameByAddress.set(
          address,
          formatMemberDisplayName({
            name: member.person.name,
            surname: member.person.surname,
            nickname: member.person.nickname,
            slug: member.person.slug,
            address,
          }),
        );
      }
      if (!roster.pagination.has_next_page) break;
      rosterPage += 1;
    }

    const memberProductionByAddress = new Map<`0x${string}`, number>();
    for (const row of collectiveRows) {
      memberProductionByAddress.set(
        row.owner,
        (memberProductionByAddress.get(row.owner) ?? 0) + row.quantity,
      );
    }

    const energyMemberAddresses = Array.from(
      new Set([
        ...memberConsumptionByAddress.keys(),
        ...memberProductionByAddress.keys(),
      ]),
    );
    const memberItems = energyMemberAddresses
      .map((address) => {
        const production = memberProductionByAddress.get(address) ?? 0;
        const consumption = memberConsumptionByAddress.get(address) ?? 0;
        return {
          address,
          name:
            memberNameByAddress.get(address) ??
            `${address.slice(0, 6)}...${address.slice(-4)}`,
          production,
          consumption,
        };
      })
      .sort(
        (a, b) => b.production + b.consumption - (a.production + a.consumption),
      )
      .slice(0, 30);

    const hasEnergyData =
      spaceProduction > 0 || spaceConsumption > 0 || memberItems.length > 0;

    return NextResponse.json({
      found: true,
      space_slug: spaceSlug,
      asOf: new Date().toISOString(),
      energy: {
        available: hasEnergyData,
        unit: 'kWh',
        space: {
          name: space.title || space.slug,
          production: spaceProduction,
          consumption: spaceConsumption,
        },
        members: memberItems,
      },
      proposals: {
        ...proposalCounts,
        onVotingItems: onVotingProposals,
      },
      signals: {
        total: signals.length,
        priorities: signalPriorities,
        types: signalTypes,
        tags: signalTags,
        items: signals
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .slice(0, 20)
          .map((signal) => ({
            id: signal.id,
            title: signal.title || `Signal #${signal.id}`,
            description: signal.description ?? '',
            priority: signal.priority,
            type: signal.type,
            tags: signal.tags ?? [],
            created_at:
              toIsoIfValid(signal.createdAt) ?? new Date().toISOString(),
          })),
      },
    });
  } catch (error) {
    console.error('Failed to fetch overview activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overview activity' },
      { status: 500 },
    );
  }
}
