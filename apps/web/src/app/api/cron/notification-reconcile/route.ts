import { NextResponse } from 'next/server';
import { db } from '@hypha-platform/storage-postgres';
import { reconcileMatrixNotifications } from '@hypha-platform/notifications/ingest';
import { chatNotificationDispatch } from '@hypha-platform/notifications/server';
import { assertCronAuth } from '../_lib/assert-cron-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Bounded backstop for the inbound AS transaction endpoint (#2483 spec §4).
 *
 * Walks the recent timeline of every known room and runs any `m.room.message` not yet in
 * `notification_processed_events` through the same pipeline the live endpoint uses. The event-id
 * claim dedupes against the live path and against overlapping runs. Time-bounded by
 * `NOTIFICATION_RECONCILE_WINDOW` (default 6h) — never a full historical backfill.
 *
 * NOT SCHEDULED (removed from vercel.json 2026-09-24): it issues one Matrix `/messages` request per
 * known room (~1000) on every run, which at a 15-minute cadence made the VPS outgoing traffic jump
 * once live delivery worked. Dendrite's own queue-and-retry against the AS endpoint is the primary
 * catch-up; run this by hand (GET with `Authorization: Bearer $CRON_SECRET`) if events are ever
 * suspected missed, or re-add a slow schedule to vercel.json.
 * Query overrides (ops/debug): `?window_ms=`, `?per_room_limit=`, `?max_rooms=`.
 */
export async function GET(request: Request) {
  const unauthorized = assertCronAuth(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const num = (key: string): number | undefined => {
    const raw = url.searchParams.get(key);
    if (!raw) return undefined;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };

  try {
    const result = await reconcileMatrixNotifications(
      {
        windowMs: num('window_ms'),
        perRoomLimit: num('per_room_limit'),
        maxRooms: num('max_rooms'),
      },
      {
        db,
        dispatch: chatNotificationDispatch,
      },
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    console.error('[matrix-as] reconcile run failed', { error });
    return NextResponse.json(
      { ok: false, error: 'reconcile failed' },
      { status: 500 },
    );
  }
}
