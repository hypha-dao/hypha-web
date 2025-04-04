import { createPeopleService } from '@hypha-platform/core/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personId: number }> },
) {
  const { personId } = await params;
  console.debug(`GET /api/v1/people/id/${personId}/`);

  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';

  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const peopleService = createPeopleService({ authToken });
    const response = await peopleService.findById({ id: personId });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch person:', error);
    return NextResponse.json(
      { error: 'Failed to fetch person' },
      { status: 500 },
    );
  }
}
