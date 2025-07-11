import { schemaCreateSpaceWeb2 } from '@hypha-platform/core/client';
import { createSpace } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const validationResult = schemaCreateSpaceWeb2.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.format();
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    const validatedData = validationResult.data;

    // TODO: implement authorization
    const space = await createSpace(validatedData, { db });

    return NextResponse.json(space);
  } catch (error) {
    console.error('Failed to create space:', error);
    return NextResponse.json(
      { error: 'Failed to create space' },
      { status: 500 },
    );
  }
}
