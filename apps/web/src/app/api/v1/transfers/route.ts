import { NextRequest, NextResponse } from 'next/server';
import { findAllTransfers } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const transactionHash = searchParams.get('transactionHash') || undefined;
  const memo = searchParams.get('memo') || undefined;

  try {
    const transfers = await findAllTransfers(
      { db },
      {
        transactionHash,
        memo,
      },
    );

    return NextResponse.json(transfers);
  } catch (error) {
    console.error('Failed to fetch transfers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfers' },
      { status: 500 },
    );
  }
}
