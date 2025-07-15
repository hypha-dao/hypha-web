import { schemaUpdateSpace } from '@hypha-platform/core/client';
import { updateSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  try {
    const { spaceSlug } = await params;
    const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
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

    const space = await updateSpaceBySlug(
      {
        ...validatedData,
        slug: spaceSlug,
      },
      { db },
    );

    return NextResponse.json(space);
  } catch (error) {
    console.error('Failed to update space:', error);
    return NextResponse.json(
      { error: 'Failed to update space' },
      { status: 500 },
    );
  }
}
