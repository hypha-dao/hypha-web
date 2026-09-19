import { NextResponse } from 'next/server';
import { db } from '@hypha-platform/storage-postgres';
import { findNetworkTreasuryStats } from '@hypha-platform/core/server';
import { assertCronAuth } from '../_lib/assert-cron-auth';

export const maxDuration = 60;

/**
 * Warm the network AUM cache so `/network` does not pay a first-visitor
 * multicall. Vercel Cron: GET with Authorization Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const unauthorized = assertCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const snapshot = await findNetworkTreasuryStats({ db });
    return NextResponse.json({
      ok: true,
      aumUsd: snapshot.aumUsd,
      treasuryCount: snapshot.treasuryCount,
      issuedTokenCount: snapshot.issuedTokenCount,
      transactionCount: snapshot.transactionCount,
      generatedAt: snapshot.generatedAt,
    });
  } catch (error) {
    console.error('[cron.network-treasury] refresh failed', error);
    return NextResponse.json(
      {
        error: 'Failed to refresh network treasury snapshot',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
