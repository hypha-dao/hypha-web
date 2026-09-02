import { NextResponse } from 'next/server';
import { db } from '@hypha-platform/storage-postgres';
import { reconcileMatrixNotifications } from '@hypha-platform/notifications/ingest';
import { assertCronAuth } from '../_lib/assert-cron-auth';
// #2485 POC — wraps loggingDispatch (Callout 1); revert to `loggingDispatch` to remove.
import { pocDispatch } from '@web/lib/ai-bot-poc';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Bounded backstop for the inbound AS transaction endpoint (#2483 spec §4).
 *
 * Walks the recent timeline of every known room and runs any `m.room.message` not yet in
 * `notification_processed_events` through the same pipeline the live endpoint uses. The event-id
 * claim dedupes against the live path and against overlapping cron runs, so this is safe to run
 * on a short interval (every 15 minutes, see vercel.json). Time-bounded by
 * `NOTIFICATION_RECONCILE_WINDOW` (default 6h) — never a full historical backfill.
 *
 * Vercel Cron: GET with `Authorization: Bearer $CRON_SECRET`.
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
        // TODO(#2470): swap for the real notification decision/delivery dispatch().
        // #2485 POC: pocDispatch calls loggingDispatch first, then runs the AI-bot handler.
        dispatch: pocDispatch,
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
