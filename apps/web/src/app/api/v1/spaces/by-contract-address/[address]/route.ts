import { NextRequest, NextResponse } from 'next/server';

import { findSpaceByAddress } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type Params = { address: string };

const isEvmAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

/**
 * Public read: Hypha space whose on-chain contract address matches (e.g. buyer/seller as space).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { address } = await params;

  if (!address || !isEvmAddress(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }

  try {
    const space = await findSpaceByAddress({ address }, { db });
    if (!space) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      id: space.id,
      title: space.title,
      slug: space.slug,
      logoUrl: space.logoUrl,
      leadImage: space.leadImage,
      address: space.address,
      web3SpaceId: space.web3SpaceId,
    });
  } catch (error) {
    console.error('Failed to fetch space by contract address:', error);
    return NextResponse.json(
      { error: 'Failed to fetch space' },
      { status: 500 },
    );
  }
}
