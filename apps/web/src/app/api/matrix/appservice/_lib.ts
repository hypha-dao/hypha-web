import { NextRequest, NextResponse } from 'next/server';
import {
  extractHsToken,
  verifyHsToken,
  HsTokenError,
} from '@hypha-platform/notifications/ingest';

/**
 * Shared `hs_token` gate for the inbound Matrix Application Service routes (#2483).
 *
 * Returns a `NextResponse` to short-circuit with (auth failure / misconfig), or `null` when the
 * caller is the homeserver and the handler should proceed. Matrix error bodies use `errcode`.
 */
export function assertHsToken(request: NextRequest): NextResponse | null {
  const url = new URL(request.url);
  const token = extractHsToken(request.headers, url.searchParams);
  try {
    verifyHsToken(token);
    return null;
  } catch (error) {
    if (error instanceof HsTokenError) {
      return NextResponse.json(
        { errcode: error.errcode, error: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
}
