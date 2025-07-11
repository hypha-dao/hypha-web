import { findPersonBySlug, getDb } from '@hypha-platform/core/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personSlug: string }> },
) {
  const { personSlug } = await params;
  console.debug(`GET /api/v1/people/${personSlug}/`);

  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';

  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const response = await findPersonBySlug(
      { slug: personSlug },
      { db: getDb({ authToken }) },
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch person:', error);
    return NextResponse.json(
      { error: 'Failed to fetch person' },
      { status: 500 },
    );
  }
}
