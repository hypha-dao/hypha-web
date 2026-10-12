import { NextResponse } from 'next/server';
import { processSignalDeadlineAlerts } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { assertCronAuth } from '../_lib/assert-cron-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Daily owner reminders / overdue alerts for signal due dates.
 * Vercel Cron: GET with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const unauthorized = assertCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await processSignalDeadlineAlerts({}, { db });
    if (result.failures > 0) {
      return NextResponse.json({ ok: false, ...result }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron.signal-deadline-alerts] failed', { error });
    return NextResponse.json(
      { ok: false, error: 'signal deadline alerts failed' },
      { status: 500 },
    );
  }
}
