import { countAllAgreements } from '@hypha-platform/core/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const total = await countAllAgreements();

    return NextResponse.json(
      { total },
      {
        headers: new Headers({
          'Cache-Control': 'public,max-age=60,immutable',
        }),
      },
    );
  } catch (error) {
    console.error('Error fetching total number of agreements:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      {
        status: 500,
      },
    );
  }
}
