import { NextResponse } from 'next/server';
import { db } from '@hypha-platform/storage-postgres';
import {
  MAX_EVENT_AGE_CAP_MS,
  pruneProcessedEvents,
} from '@hypha-platform/notifications/ingest';
import { assertCronAuth } from '../_lib/assert-cron-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * How long a `notification_processed_events` row is kept. Dendrite can replay a transaction we
 * already recorded (a crash between the write and the ACK, then an outage). That is safe because a
 * row outlives the ingest age guard: `NOTIFICATION_MAX_EVENT_AGE` is capped at `MAX_EVENT_AGE_CAP_MS`
 * (3 days) and events dated in the future are rejected, so past that age a replay is skipped as stale
 * whether or not its row still exists. Fixed rather than derived from the env on purpose — a value
 * that follows the setting could not un-delete rows if the setting were later raised.
 */
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

if (RETENTION_MS < 2 * MAX_EVENT_AGE_CAP_MS) {
  throw new Error('ledger retention must stay well above the event age cap');
}

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
