import { createSpaceService, Space } from '@hypha-platform/core/server';
import { NextRequest, NextResponse } from 'next/server';

type Web3SpaceIds = number[] | undefined;

export async function GET(request: NextRequest) {
  try {
    const queryParams = request.nextUrl.searchParams;
    const web3SpaceIds: Web3SpaceIds = queryParams.has('web3SpaceIds')
      ? (queryParams.get('web3SpaceIds')?.split(',') ?? []).map(Number).filter(id => !Number.isNaN(id))
      : undefined;
    const spaceService = createSpaceService();
    const spaces = web3SpaceIds
      ? await spaceService.getAllByWeb3SpaceIds(web3SpaceIds)
      : await spaceService.getAll();
    return NextResponse.json(spaces);
  } catch (error) {
    console.error('Failed to fetch spaces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spaces' },
      { status: 500 },
    );
  }
}
