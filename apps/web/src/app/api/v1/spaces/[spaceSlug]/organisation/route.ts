import {
  findSpaceBySlug,
  getAllOrganizationSpacesForNodeById,
  Space,
} from '@hypha-platform/core/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@hypha-platform/storage-postgres';

export async function GET(
  _: NextRequest,
  {
    params,
  }: {
    params: Promise<{ spaceSlug: string }>;
  },
) {
  const { spaceSlug } = await params;

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const spaces: Space[] = await getAllOrganizationSpacesForNodeById({
      id: space.id,
    });

    return NextResponse.json([...spaces]);
  } catch (err: any) {
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json(
      {
        error: 'Failed to get spaces',
        message: error.message,
      },
      {
        status: 500,
      },
    );
  }
}
