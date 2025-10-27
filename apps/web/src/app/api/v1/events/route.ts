import { NextRequest, NextResponse } from 'next/server';
import { findAllEvents } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || undefined;

  try {
    const events = await findAllEvents({ db }, { type });

    return NextResponse.json(events);
  } catch (error) {
    console.error('Failed to fetch tokens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tokens' },
      { status: 500 },
    );
  }
}
