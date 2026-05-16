import { NextRequest, NextResponse } from 'next/server';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import {
  createSpaceDiscussionSummary,
  enqueueSignalEvaluationFromMemory,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;
  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (space.web3SpaceId != null) {
      if (!canConvertToBigInt(space.web3SpaceId)) {
        return NextResponse.json(
          { error: 'Space has an invalid on-chain space id' },
          { status: 403 },
        );
      }
      const { hasAccess, response } = await checkSpaceAccess(
        request,
        space.web3SpaceId as number,
      );
      if (!hasAccess && response) return response;
    }

    const authHeader = request.headers.get('authorization');
    const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
    const bearer = bearerMatch?.[1]?.trim() || undefined;
    const result = await createSpaceDiscussionSummary(
      {
        spaceSlug,
        authToken: bearer,
        requestUrlForSessionMatrix: request.url,
      },
      { db },
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    await enqueueSignalEvaluationFromMemory(
      {
        spaceSlug,
        triggerKind: 'discussion_summary',
      },
      { db },
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error(
      '[discussion-summary] Failed to summarize discussion:',
      error,
    );
    return NextResponse.json(
      { error: 'Failed to summarize discussion' },
      { status: 500 },
    );
  }
}
