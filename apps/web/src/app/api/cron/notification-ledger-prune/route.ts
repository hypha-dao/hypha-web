import { NextResponse } from 'next/server';
import { db } from '@hypha-platform/storage-postgres';
import {
  pruneProcessedEvents,
  resolveMaxEventAgeMs,
} from '@hypha-platform/notifications/ingest';
import { assertCronAuth } from '../_lib/assert-cron-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * How long a `notification_processed_events` row is kept. Dendrite can replay a transaction we
 * already recorded (a crash between the write and the ACK, then an outage). That is safe as long as a
 * row outlives `NOTIFICATION_MAX_EVENT_AGE`: past that age the ingest pipeline skips the event as
 * stale whether or not it is in the ledger, so a pruned row can never turn into a duplicate
 * notification. Hence retention is never allowed below twice the age guard.
 */
const MIN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Daily housekeeping for the inbound Matrix AS idempotency ledger (#2483 / #2470): one `DELETE` of
 * rows older than the retention above. It used to run at the end of the reconcile cron, which is no longer
 * scheduled — see `notification-reconcile/route.ts`.
 *
 * Vercel Cron: GET with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const unauthorized = assertCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const retentionMs = Math.max(MIN_RETENTION_MS, 2 * resolveMaxEventAgeMs());
    const pruned = await pruneProcessedEvents(retentionMs, db);
    return NextResponse.json({ ok: true, pruned });
  } catch (error) {
    console.error('[matrix-as] ledger prune failed', { error });
    return NextResponse.json(
      { ok: false, error: 'prune failed' },
      { status: 500 },
    );
  }
}
