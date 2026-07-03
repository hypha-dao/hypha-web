import { NextRequest, NextResponse } from 'next/server';

import type { PaginatedResponse } from '@hypha-platform/core/client';
import {
  COHERENCE_TAGS,
  COHERENCE_TYPES,
  findCoherenceUpvoteSummaries,
  findSelf,
  findSpaceBySlug,
  getDb,
  type Coherence,
  type CoherenceTag,
  type CoherenceType,
} from '@hypha-platform/core/server';
import {
  COHERENCE_PRIORITIES,
  type CoherencePriority,
} from '@hypha-platform/ui-utils';
import { getAllCoherences } from '@hypha-platform/core/coherence/server/web3';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

type Params = { spaceSlug: string };

function parsePositiveInt(raw: string | null, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function paginateCoherences(
  items: Coherence[],
  page: number,
  pageSize: number,
): PaginatedResponse<Coherence> {
  const total = items.length;
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const totalPages = total === 0 ? 0 : Math.ceil(total / safePageSize);
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * safePageSize;
  const data = items.slice(offset, offset + safePageSize);

  return {
    data,
    pagination: {
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages,
      hasNextPage: totalPages > 0 && safePage < totalPages,
      hasPreviousPage: totalPages > 0 && safePage > 1,
    },
  };
}

function parseOrderBy(
  raw: string | null,
): 'mostrecent' | 'mostmessages' | 'mostviews' | 'mostupvoted' | undefined {
  if (
    raw === 'mostrecent' ||
    raw === 'mostmessages' ||
    raw === 'mostviews' ||
    raw === 'mostupvoted'
  ) {
    return raw;
  }
  return undefined;
}

/** Resolve the authenticated viewer's person id (if any) for `myUpvote`. */
async function resolveViewerPersonId(
  request: NextRequest,
): Promise<number | null> {
  const authToken = request.headers.get('Authorization')?.split(' ')[1];
  if (!authToken) return null;
  try {
    const viewer = await findSelf({ db: getDb({ authToken }) });
    return viewer?.id ?? null;
  } catch {
    return null;
  }
}

function toBigIntOrZero(value: string | undefined): bigint {
  try {
    return BigInt(value ?? '0');
  } catch {
    return 0n;
  }
}

function parseType(raw: string | null): CoherenceType | undefined {
  if (raw && (COHERENCE_TYPES as readonly string[]).includes(raw)) {
    return raw as CoherenceType;
  }
  return undefined;
}

function parsePriority(raw: string | null): CoherencePriority | undefined {
  if (raw && (COHERENCE_PRIORITIES as readonly string[]).includes(raw)) {
    return raw as CoherencePriority;
  }
  return undefined;
}

function parseTags(url: URL): CoherenceTag[] | undefined {
  const rawValues = url.searchParams
    .getAll('tags')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  if (rawValues.length === 0) return undefined;
  const allowed = new Set<string>(COHERENCE_TAGS);
  const tags = [
    ...new Set(
      rawValues.filter((value): value is CoherenceTag => allowed.has(value)),
    ),
  ];
  return tags.length > 0 ? tags : undefined;
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

    const url = new URL(request.url);
    const includeArchivedRaw = url.searchParams.get('includeArchived');
    const includeArchived =
      includeArchivedRaw === '1' ||
      includeArchivedRaw === 'true' ||
      includeArchivedRaw === 'yes';

    const orderBy = parseOrderBy(url.searchParams.get('orderBy'));

    const coherences = await getAllCoherences({
      spaceId: space.id,
      search: url.searchParams.get('search')?.trim() || undefined,
      type: parseType(url.searchParams.get('type')),
      tags: parseTags(url),
      priority: parsePriority(url.searchParams.get('priority')),
      includeArchived,
      orderBy,
    });

    const viewerPersonId = await resolveViewerPersonId(request);
    const upvoteSummaries = await findCoherenceUpvoteSummaries(
      {
        coherenceIds: coherences.map((coherence) => coherence.id),
        viewerPersonId,
      },
      { db },
    );

    let enriched: Coherence[] = coherences.map((coherence) => ({
      ...coherence,
      upvotes: upvoteSummaries[coherence.id],
    }));

    if (orderBy === 'mostupvoted') {
      enriched = [...enriched].sort((a, b) => {
        const diff =
          toBigIntOrZero(b.upvotes?.totalVotingPower) -
          toBigIntOrZero(a.upvotes?.totalVotingPower);
        if (diff !== 0n) return diff > 0n ? 1 : -1;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    }

    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const pageSize = parsePositiveInt(url.searchParams.get('pageSize'), 100);

    return NextResponse.json(paginateCoherences(enriched, page, pageSize));
  } catch (error) {
    console.error('Failed to fetch coherences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coherences' },
      { status: 500 },
    );
  }
}
