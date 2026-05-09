import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
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
          pageSize: 100,
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

    const membershipExitProposalDates = proposalsResult.result.found
      ? proposalsResult.result.documents
          .filter((proposal) => {
            if (proposal.status !== 'accepted') return false;
            const label = proposal.label?.toLowerCase() ?? '';
            return label.includes('membership exit');
          })
          .map((proposal) => toIsoIfValid(proposal.updatedAt))
      : [];

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

    let runningPeople = 0;
    let runningSpaces = 0;
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
