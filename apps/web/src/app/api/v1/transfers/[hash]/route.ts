import { NextRequest, NextResponse } from 'next/server';
import { findTransferByTransactionHash } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

export async function GET(
  request: NextRequest,
  { params }: { params: { hash: string } },
) {
  const { hash } = params;

  try {
    const transfer = await findTransferByTransactionHash(hash, { db });

    if (!transfer) {
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(transfer);
  } catch (error) {
    console.error('Failed to fetch transfer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfer' },
      { status: 500 },
    );
  }
}
