import { NextRequest, NextResponse } from 'next/server';
import { findAllTokens } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || undefined;
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';

  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tokens = await findAllTokens({ db }, { search });

    return NextResponse.json(tokens);
  } catch (error) {
    console.error('Failed to fetch tokens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tokens' },
      { status: 500 },
    );
  }
}
