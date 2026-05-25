import { NextRequest, NextResponse } from 'next/server';

import {
  COHERENCE_TYPES,
  findSpaceBySlug,
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

function parseOrderBy(
  raw: string | null,
): 'mostrecent' | 'mostmessages' | 'mostviews' | undefined {
  if (raw === 'mostrecent' || raw === 'mostmessages' || raw === 'mostviews') {
    return raw;
  }
  return undefined;
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

    const coherences = await getAllCoherences({
      spaceId: space.id,
      search: url.searchParams.get('search')?.trim() || undefined,
      type: parseType(url.searchParams.get('type')),
      priority: parsePriority(url.searchParams.get('priority')),
      includeArchived,
      orderBy: parseOrderBy(url.searchParams.get('orderBy')),
    });

    return NextResponse.json(coherences);
  } catch (error) {
    console.error('Failed to fetch coherences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coherences' },
      { status: 500 },
    );
  }
}
