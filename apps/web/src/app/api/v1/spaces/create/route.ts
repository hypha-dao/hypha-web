import {
  createSpaceService,
  schemaCreateSpace,
} from '@hypha-platform/core/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const validationResult = schemaCreateSpace.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.format();
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    const validatedData = validationResult.data;
    const spaceService = createSpaceService({ authToken });

    const space = await spaceService.create(validatedData);

    return NextResponse.json(space);
  } catch (error) {
    console.error('Failed to create space:', error);
    return NextResponse.json(
      { error: 'Failed to create space' },
      { status: 500 },
    );
  }
}
