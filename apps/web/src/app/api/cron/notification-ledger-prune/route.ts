import { NextResponse } from 'next/server';
import { db } from '@hypha-platform/storage-postgres';
import { pruneProcessedEvents } from '@hypha-platform/notifications/ingest';
import { assertCronAuth } from '../_lib/assert-cron-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * How long a `notification_processed_events` row is kept. The ledger only has to outlast the longest
 * time Dendrite could redeliver a transaction we already recorded (a crash between the write and the
 * ACK, or an outage replay) — days, not hours. Too short and a replayed event is claimed again and
 * notifies twice; longer than needed only costs a few tiny rows.
 */
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Daily housekeeping for the inbound Matrix AS idempotency ledger (#2483 / #2470): one `DELETE` of
 * rows older than `RETENTION_MS`. It used to run at the end of the reconcile cron, which is no longer
 * scheduled — see `notification-reconcile/route.ts`.
 *
 * Vercel Cron: GET with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const unauthorized = assertCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const pruned = await pruneProcessedEvents(RETENTION_MS, db);
    return NextResponse.json({ ok: true, pruned });
  } catch (error) {
    console.error('[matrix-as] ledger prune failed', { error });
    return NextResponse.json(
      { ok: false, error: 'prune failed' },
      { status: 500 },
    );
  }
}
