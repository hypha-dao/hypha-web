import { backfillStaleIssueTokenAddresses } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextResponse } from 'next/server';

/**
 * Periodic retry for issue-token rows missing `address` (client backfill missed).
 * Secure with `CRON_SECRET` — same pattern as typical Vercel cron.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    );
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(
    100,
    Math.max(
      1,
      Number.parseInt(url.searchParams.get('limit') ?? '25', 10) || 25,
    ),
  );

  try {
    const results = await backfillStaleIssueTokenAddresses({ db, limit });
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[cron/backfill-token-addresses]', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
