import { NextRequest, NextResponse } from 'next/server';
import { findTokenByAddress } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token || !EVM_ADDRESS.test(token)) {
    return NextResponse.json(
      { error: 'Valid token address is required' },
      { status: 400 },
    );
  }

  try {
    const result = await findTokenByAddress(token, { db });
    if (!result) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }
    return NextResponse.json({ iconUrl: result.iconUrl ?? null });
  } catch (error) {
    console.error(`Failed to fetch token image for ${token}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch token image' },
      { status: 500 },
    );
  }
}
