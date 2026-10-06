import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { db } from '@hypha-platform/storage-postgres';
import { findNetworkDashboardStats } from '@hypha-platform/core/server';

const getCachedStats = unstable_cache(
  async () => findNetworkDashboardStats({ db }),
  ['network-api-stats-v1'],
  { revalidate: 300 },
);

export async function GET() {
  try {
    const stats = await getCachedStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to load network stats', error);
    return NextResponse.json(
      { error: 'Failed to load network stats' },
      { status: 500 },
    );
  }
}
