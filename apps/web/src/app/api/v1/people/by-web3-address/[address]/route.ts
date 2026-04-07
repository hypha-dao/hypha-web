import { NextRequest, NextResponse } from 'next/server';

import { findPersonByWeb3Address } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type Params = { address: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { address } = await params;

  try {
    const person = await findPersonByWeb3Address({ address }, { db });
    return NextResponse.json(person);
  } catch (error) {
    console.error('Failed to fetch person:', error);
    return NextResponse.json(
      { error: 'Failed to fetch person' },
      { status: 500 },
    );
  }
}
