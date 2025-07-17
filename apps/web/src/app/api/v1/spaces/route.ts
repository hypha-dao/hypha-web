import { NextRequest, NextResponse } from 'next/server';
import { findAllSpaces, findAllSpacesByWeb3SpaceIds } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type Web3SpaceIds = number[] | undefined;

export async function GET(request: NextRequest) {
  try {
    const queryParams = request.nextUrl.searchParams;
    const web3SpaceIds: Web3SpaceIds = queryParams.has('web3SpaceIds')
      ? (queryParams.get('web3SpaceIds')?.split(',') ?? [])
          .map(Number)
          .filter((id) => !Number.isNaN(id))
      : undefined;
    const spaces = web3SpaceIds
      ? await findAllSpacesByWeb3SpaceIds({ web3SpaceIds }, { db })
      : await findAllSpaces({ db });
    return NextResponse.json(spaces);
  } catch (error) {
    console.error('Failed to fetch spaces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spaces' },
      { status: 500 },
    );
  }
}
