import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeSpacePanelInteraction,
  findSpaceBySlug,
  readSignalWorkflowConfig,
  schemaSignalWorkflowConfig,
  updateSignalWorkflowConfig,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { parseBearerToken } from '@web/utils/parse-bearer-token';

type Params = { spaceSlug: string };

async function assertReadAccess(
  request: NextRequest,
  space: NonNullable<Awaited<ReturnType<typeof findSpaceBySlug>>>,
) {
  if (space.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
    const { hasAccess, response } = await checkSpaceAccess(
      request,
      space.web3SpaceId as number,
    );
    if (!hasAccess && response) return response;
    return null;
  }
  return null;
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
    const denied = await assertReadAccess(request, space);
    if (denied) return denied;

    const config = await readSignalWorkflowConfig(
      { spaceId: space.id },
      { db },
    );
    return NextResponse.json(config);
  } catch (error) {
    console.error('Failed to fetch signal workflow:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signal workflow' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  const authToken = parseBearerToken(request.headers.get('Authorization'));
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const interactionAuth = await authorizeSpacePanelInteraction({
      spaceSlug,
      authToken,
    });
    if (!interactionAuth.authorized) {
      return NextResponse.json(
        { error: interactionAuth.message },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = schemaSignalWorkflowConfig.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const config = await updateSignalWorkflowConfig(
      { spaceId: space.id, config: parsed.data },
      { db },
    );
    return NextResponse.json(config);
  } catch (error) {
    console.error('Failed to update signal workflow:', error);
    return NextResponse.json(
      { error: 'Failed to update signal workflow' },
      { status: 500 },
    );
  }
}
