import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  getAllCoherences,
  getDocumentsBySpaceSlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { checkSpaceAccess } from '@web/utils/check-space-access';

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

    return NextResponse.json({
      found: true,
      space_slug: spaceSlug,
      asOf: new Date().toISOString(),
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
