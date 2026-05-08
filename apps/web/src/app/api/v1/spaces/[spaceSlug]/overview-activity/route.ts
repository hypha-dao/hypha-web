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

function buildJoinedAtMonthBuckets(
  joinedAtValues: Array<string | null>,
  maxMonths = 12,
): MonthBucket[] {
  const now = new Date();
  const nowMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const joinedDates = joinedAtValues
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .map(
      (value) =>
        new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1)),
    );

  if (joinedDates.length === 0) {
    return buildRecentMonthBuckets(6);
  }

  const earliest = joinedDates.reduce(
    (min, value) => (value < min ? value : min),
    joinedDates[0]!,
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

    const byPriority = new Map<string, number>();
    const byType = new Map<string, number>();
    const matrix = new Map<string, number>();
    for (const signal of signals) {
      byPriority.set(
        signal.priority,
        (byPriority.get(signal.priority) ?? 0) + 1,
      );
      byType.set(signal.type, (byType.get(signal.type) ?? 0) + 1);
      const key = `${signal.priority}:::${signal.type}`;
      matrix.set(key, (matrix.get(key) ?? 0) + 1);
    }

    const signalTypes = Array.from(byType.keys());
    const signalPriorities = Array.from(byPriority.keys());

    const memberEntries: Array<{
      member_kind: 'person' | 'space';
      joined_at: string | null;
    }> = [];

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
          joined_at: member.joined_at,
        })),
      );

      if (!roster.pagination.has_next_page) break;
      rosterPage += 1;
    }

    const months = buildJoinedAtMonthBuckets(
      memberEntries.map((item) => item.joined_at),
      12,
    );
    const monthIndex = new Map(
      months.map((item, index) => [item.month, index]),
    );
    for (const member of memberEntries) {
      if (!member.joined_at) continue;
      const joinedDate = new Date(member.joined_at);
      if (Number.isNaN(joinedDate.getTime())) continue;
      const key = toMonthKey(joinedDate);
      const index = monthIndex.get(key);
      if (index == null) continue;
      if (member.member_kind === 'person') {
        months[index]!.people += 1;
      } else {
        months[index]!.spaces += 1;
      }
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
        by_priority: Object.fromEntries(byPriority),
        by_type: Object.fromEntries(byType),
        priorities: signalPriorities,
        types: signalTypes,
        matrix: signalPriorities.flatMap((priority) =>
          signalTypes.map((type) => ({
            priority,
            type,
            count: matrix.get(`${priority}:::${type}`) ?? 0,
          })),
        ),
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
