import { NextRequest, NextResponse } from 'next/server';
import { assertHsToken } from '../../_lib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * `GET /_matrix/app/v1/users/{userId}` — homeserver probe asking whether the AS will handle a
 * user in its namespace (#2483). Hypha provisions its own users; there is nothing for the AS to
 * lazily create, so a `200 {}` ("handled, nothing to do") is the correct answer for any probe
 * that reaches us. Still `hs_token`-gated.
 */
export async function GET(request: NextRequest) {
  const authFailure = assertHsToken(request);
  if (authFailure) return authFailure;
  return NextResponse.json({}, { status: 200 });
}
