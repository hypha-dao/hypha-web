import { NextRequest, NextResponse } from 'next/server';

import { findPersonByWeb3AddressIfMemberInAnySpace } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type Params = { address: string };

/**
 * Public read: profile for a wallet when that person is a member of any space.
 * Used on proposal views where the party may not be in the current space.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { address } = await params;

  try {
    const person = await findPersonByWeb3AddressIfMemberInAnySpace(
      { address },
      { db },
    );
    return NextResponse.json(person);
  } catch (error) {
    console.error('Failed to fetch member profile by web3 address:', error);
    return NextResponse.json(
      { error: 'Failed to fetch member profile' },
      { status: 500 },
    );
  }
}
