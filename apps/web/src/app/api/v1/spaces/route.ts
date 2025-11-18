import { NextRequest, NextResponse } from 'next/server';
import { getSpacesByWeb3Ids, getAllSpaces } from '@hypha-platform/core/server';

type Web3SpaceIds = number[] | undefined;

export async function GET(request: NextRequest) {
  try {
    const queryParams = request.nextUrl.searchParams;

    const web3SpaceIds: Web3SpaceIds = queryParams.has('web3SpaceIds')
      ? (queryParams.get('web3SpaceIds')?.split(',') ?? [])
          .map(Number)
          .filter((id) => !Number.isNaN(id))
      : undefined;

    const parentOnlyParam = queryParams.get('parentOnly');
    const parentOnly =
      parentOnlyParam !== null ? parentOnlyParam === 'true' : undefined;

    let spaces;

    if (web3SpaceIds) {
      const options = parentOnly !== undefined ? { parentOnly } : undefined;
      spaces = await getSpacesByWeb3Ids(web3SpaceIds, options);
    } else {
      spaces = await getAllSpaces({ parentOnly });
    }

    return NextResponse.json(spaces);
  } catch (error) {
    console.error('Failed to fetch spaces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spaces' },
      { status: 500 },
    );
  }
}
