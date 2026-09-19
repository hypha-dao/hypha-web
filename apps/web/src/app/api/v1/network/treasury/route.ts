import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { db } from '@hypha-platform/storage-postgres';
import { findNetworkTreasuryStats } from '@hypha-platform/core/server';

export const maxDuration = 60;

const getCachedTreasury = unstable_cache(
  async () => findNetworkTreasuryStats({ db }),
  ['network-api-treasury-v1'],
  { revalidate: 300 },
);

export async function GET() {
  try {
    const snapshot = await getCachedTreasury();
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('Failed to load network treasury snapshot', error);
    return NextResponse.json(
      { error: 'Failed to load network treasury snapshot' },
      { status: 500 },
    );
  }
}
