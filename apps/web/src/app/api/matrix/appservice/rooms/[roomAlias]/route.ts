import { NextRequest, NextResponse } from 'next/server';
import { assertHsToken } from '../../_lib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * `GET /_matrix/app/v1/rooms/{roomAlias}` — homeserver probe for a room alias the AS might own
 * (#2483). Hypha registers no room-alias namespace, so this is always `404 M_NOT_FOUND`. Still
 * `hs_token`-gated.
 */
export async function GET(request: NextRequest) {
  const authFailure = assertHsToken(request);
  if (authFailure) return authFailure;
  return NextResponse.json(
    { errcode: 'M_NOT_FOUND', error: 'no room alias namespace' },
    { status: 404 },
  );
}
