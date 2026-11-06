import { schemaUpdateSpace } from '@hypha-platform/core/client';
import {
  authorizeSpacePanelInteraction,
  findSpaceBySlug,
  isWeb3SpaceIdConflictError,
  updateSpaceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextResponse } from 'next/server';
import { parseBearerToken } from '@web/utils/parse-bearer-token';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  try {
    const { spaceSlug } = await params;
    const authToken = parseBearerToken(request.headers.get('Authorization'));
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the request body
    const body = await request.json();

    // Validate with Zod schema
    const validationResult = schemaUpdateSpace.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.format();
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    const validatedData = validationResult.data;

    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const interactionAuth = await authorizeSpacePanelInteraction({
      spaceSlug: space.slug,
      authToken,
    });
    if (!interactionAuth.authorized) {
      return NextResponse.json(
        { error: interactionAuth.message },
        { status: 403 },
      );
    }

    const updatedSpace = await updateSpaceBySlug(
      {
        ...validatedData,
        slug: spaceSlug,
      },
      { db },
    );

    return NextResponse.json(updatedSpace);
  } catch (error) {
    if (isWeb3SpaceIdConflictError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 409 },
      );
    }
    console.error('Failed to update space:', error);
    return NextResponse.json(
      { error: 'Failed to update space' },
      { status: 500 },
    );
  }
}
