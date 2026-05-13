import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  fetchProposalOutcomeSetsForSpace,
  getAllCoherences,
  getDocumentsBySpaceSlug,
  getSpaceMembersRoster,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { checkSpaceAccess } from '@web/utils/check-space-access';

type Params = { spaceSlug: string };

type MonthBucket = {
  month: string;
  people: number;
  spaces: number;
};

function toIsoIfValid(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toMonthKey(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function buildRecentMonthBuckets(size: number): MonthBucket[] {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const buckets: MonthBucket[] = [];

  for (let offset = size - 1; offset >= 0; offset -= 1) {
    const cursor = new Date(base);
    cursor.setUTCMonth(base.getUTCMonth() - offset);
    buckets.push({ month: toMonthKey(cursor), people: 0, spaces: 0 });
  }

  return buckets;
}

function buildTimelineMonthBuckets(
  eventDateValues: Array<string | null>,
  maxMonths = 12,
): MonthBucket[] {
  const now = new Date();
  const nowMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const eventDates = eventDateValues
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .map(
      (value) =>
        new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1)),
    );

  if (eventDates.length === 0) {
    return buildRecentMonthBuckets(6);
  }

  const earliest = eventDates.reduce(
    (min, value) => (value < min ? value : min),
    eventDates[0]!,
  );
  const latest = nowMonth;

  const monthSpan =
    (latest.getUTCFullYear() - earliest.getUTCFullYear()) * 12 +
    (latest.getUTCMonth() - earliest.getUTCMonth()) +
    1;
  const boundedSpan = Math.max(1, Math.min(monthSpan, maxMonths));

  const start = new Date(latest);
  start.setUTCMonth(start.getUTCMonth() - (boundedSpan - 1));

  const buckets: MonthBucket[] = [];
  for (let offset = 0; offset < boundedSpan; offset += 1) {
    const cursor = new Date(start);
    cursor.setUTCMonth(start.getUTCMonth() + offset);
    buckets.push({ month: toMonthKey(cursor), people: 0, spaces: 0 });
  }

  return buckets;
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

    let web3SpaceIdNum: number | null = null;
    if (space.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
      web3SpaceIdNum =
        typeof space.web3SpaceId === 'number'
          ? space.web3SpaceId
          : Number(space.web3SpaceId);
      if (!Number.isFinite(web3SpaceIdNum)) {
        return NextResponse.json(
          { error: 'Invalid web3 space id' },
          { status: 500 },
        );
      }
      const { hasAccess, response } = await checkSpaceAccess(
        request,
        web3SpaceIdNum,
      );
      if (!hasAccess && response) {
        return response;
      }
    }

    const authHeader = request.headers.get('authorization');
    const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
    const bearer = bearerMatch?.[1]?.trim() || undefined;

    const [signals, proposalOutcomes] = await Promise.all([
      getAllCoherences({
        spaceId: space.id,
        includeArchived: false,
      }),
      web3SpaceIdNum == null
        ? Promise.resolve(null)
        : fetchProposalOutcomeSetsForSpace(web3SpaceIdNum),
    ]);
    const allProposals: Array<{
      status?: string;
      label?: string | null;
      updatedAt?: string | Date | null;
      web3ProposalId?: number | null;
    }> = [];
    let proposalsPage = 1;

    while (true) {
      const proposalsResult = await getDocumentsBySpaceSlug(
        {
          spaceSlug,
          page: proposalsPage,
          pageSize: 100,
          state: 'proposal',
        },
        { db, authToken: bearer },
      );

      if (proposalsResult.access === 'denied') {
        return NextResponse.json(
          { error: proposalsResult.message },
          { status: 403 },
        );
      }

      if (!proposalsResult.result.found) {
        break;
      }

      allProposals.push(...proposalsResult.result.documents);

      if (!proposalsResult.result.pagination.has_next_page) {
        break;
      }
      proposalsPage += 1;
    }

    const proposalCounts = {
      onVoting: 0,
      accepted: 0,
      refused: 0,
    };

    const resolveProposalStatus = (proposal: {
      status?: string;
      web3ProposalId?: number | null;
    }): 'accepted' | 'rejected' | 'onVoting' | null => {
      const proposalId =
        typeof proposal.web3ProposalId === 'number' &&
        Number.isFinite(proposal.web3ProposalId) &&
        proposal.web3ProposalId > 0
          ? proposal.web3ProposalId
          : null;

      if (proposalOutcomes && proposalId != null) {
        if (proposalOutcomes.withdrawn.has(proposalId)) return null;
        if (proposalOutcomes.accepted.has(proposalId)) return 'accepted';
        if (proposalOutcomes.rejected.has(proposalId)) return 'rejected';
        return 'onVoting';
      }

      if (proposalOutcomes && proposalId == null) {
        // Keep behavior aligned with Agreements tab: skip proposal docs that do
        // not map to an on-chain proposal id when chain outcomes are available.
        return null;
      }

      if (proposalId == null) {
        return null;
      }

      if (proposal.status === 'accepted') return 'accepted';
      if (proposal.status === 'rejected') return 'rejected';
      return 'onVoting';
    };

    for (const proposal of allProposals) {
      const resolvedStatus = resolveProposalStatus(proposal);
      if (resolvedStatus === 'accepted') {
        proposalCounts.accepted += 1;
      } else if (resolvedStatus === 'rejected') {
        proposalCounts.refused += 1;
      } else if (resolvedStatus === 'onVoting') {
        proposalCounts.onVoting += 1;
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

    const memberEntries: Array<{
      member_kind: 'person' | 'space';
      resolved_joined_at: string | null;
    }> = [];
    const hostSpaceCreatedAt = toIsoIfValid(space.createdAt);

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
      memberEntries.push(
        ...roster.members.map((member) => ({
          member_kind: member.member_kind,
          resolved_joined_at:
            member.joined_at ??
            (member.member_kind === 'space'
              ? toIsoIfValid(member.space.createdAt)
              : hostSpaceCreatedAt),
        })),
      );

      if (!roster.pagination.has_next_page) break;
      rosterPage += 1;
    }

    const membershipExitProposalDates = allProposals
      .filter((proposal) => {
        if (resolveProposalStatus(proposal) !== 'accepted') return false;
        const label = proposal.label?.toLowerCase() ?? '';
        return label.includes('membership exit');
      })
      .map((proposal) => toIsoIfValid(proposal.updatedAt));

    const months = buildTimelineMonthBuckets(
      [
        ...memberEntries.map((item) => item.resolved_joined_at),
        ...membershipExitProposalDates,
      ],
      12,
    );
    const monthJoinDeltas = new Map<
      string,
      { people: number; spaces: number }
    >();
    const monthExitDeltas = new Map<
      string,
      { people: number; spaces: number }
    >();

    for (const member of memberEntries) {
      if (!member.resolved_joined_at) continue;
      const joinedDate = new Date(member.resolved_joined_at);
      if (Number.isNaN(joinedDate.getTime())) continue;
      const key = toMonthKey(joinedDate);
      const current = monthJoinDeltas.get(key) ?? { people: 0, spaces: 0 };
      if (member.member_kind === 'person') {
        current.people += 1;
      } else {
        current.spaces += 1;
      }
      monthJoinDeltas.set(key, current);
    }

    for (const exitAt of membershipExitProposalDates) {
      if (!exitAt) continue;
      const exitDate = new Date(exitAt);
      if (Number.isNaN(exitDate.getTime())) continue;
      const key = toMonthKey(exitDate);
      const current = monthExitDeltas.get(key) ?? { people: 0, spaces: 0 };
      // Membership exit proposals currently target members; model as person exits.
      current.people += 1;
      monthExitDeltas.set(key, current);
    }

    const firstBucketMonth = months[0]?.month;
    let runningPeople = 0;
    let runningSpaces = 0;
    if (firstBucketMonth) {
      for (const member of memberEntries) {
        if (!member.resolved_joined_at) continue;
        const joinedDate = new Date(member.resolved_joined_at);
        if (Number.isNaN(joinedDate.getTime())) continue;
        const joinedMonth = toMonthKey(joinedDate);
        if (joinedMonth >= firstBucketMonth) continue;
        if (member.member_kind === 'person') {
          runningPeople += 1;
        } else {
          runningSpaces += 1;
        }
      }

      for (const exitAt of membershipExitProposalDates) {
        if (!exitAt) continue;
        const exitDate = new Date(exitAt);
        if (Number.isNaN(exitDate.getTime())) continue;
        const exitMonth = toMonthKey(exitDate);
        if (exitMonth >= firstBucketMonth) continue;
        runningPeople = Math.max(0, runningPeople - 1);
      }
    }

    for (const bucket of months) {
      const joins = monthJoinDeltas.get(bucket.month) ?? {
        people: 0,
        spaces: 0,
      };
      const exits = monthExitDeltas.get(bucket.month) ?? {
        people: 0,
        spaces: 0,
      };

      runningPeople = Math.max(0, runningPeople + joins.people - exits.people);
      runningSpaces = Math.max(0, runningSpaces + joins.spaces - exits.spaces);

      bucket.people = runningPeople;
      bucket.spaces = runningSpaces;
    }

    return NextResponse.json({
      found: true,
      space_slug: spaceSlug,
      asOf: new Date().toISOString(),
      energy: {
        available: false,
      },
      proposals: proposalCounts,
      signals: {
        total: signals.length,
        priorities: signalPriorities,
        types: signalTypes,
        tags: signalTags,
        items: signals.map((signal) => ({
          id: signal.id,
          priority: signal.priority,
          type: signal.type,
          tags: signal.tags ?? [],
          created_at: signal.createdAt.toISOString(),
        })),
      },
      members: {
        monthly: months,
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
