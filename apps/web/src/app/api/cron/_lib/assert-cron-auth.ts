import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
 */
export function assertCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 503 },
    );
  }
  const auth = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const authBuf = Buffer.from(auth);
  const expectedBuf = Buffer.from(expected);
  const authorized =
    authBuf.length === expectedBuf.length &&
    timingSafeEqual(authBuf, expectedBuf);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
