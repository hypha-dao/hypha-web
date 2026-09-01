import { timingSafeEqual } from 'node:crypto';

/**
 * `hs_token` verification for inbound AS transactions (#2483).
 *
 * `hs_token` is the shared secret the homeserver uses to authenticate *itself* to us — the
 * endpoint is an open webhook otherwise. Constant-time compare, never logged, 403 on mismatch.
 *
 * Per-env `url:` (spec §3): each deployment's registration file points at its own environment,
 * so we verify against exactly one token — `HYPHA_MATRIX_AS_HS_TOKEN`.
 */

export class HsTokenError extends Error {
  /** HTTP status the route adapter should return. */
  readonly status: number;
  readonly errcode: string;

  constructor(
    message: string,
    { status, errcode }: { status: number; errcode: string },
  ) {
    super(message);
    this.name = 'HsTokenError';
    this.status = status;
    this.errcode = errcode;
  }
}

/**
 * Pull the token from either transport the AS spec has used:
 *  - current:  `Authorization: Bearer <hs_token>`
 *  - legacy:   `?access_token=<hs_token>`
 */
export function extractHsToken(
  headers: Headers,
  searchParams: URLSearchParams,
): string | null {
  const auth = headers.get('authorization') ?? '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) return bearer;
  const queryToken = searchParams.get('access_token')?.trim();
  return queryToken || null;
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Throws `HsTokenError` on any failure (route maps `.status`); returns void on success.
 * `503` when the secret isn't configured (mirrors `assert-cron-auth`), `403` on mismatch.
 */
export function verifyHsToken(provided: string | null): void {
  const expected = process.env.HYPHA_MATRIX_AS_HS_TOKEN?.trim();
  if (!expected) {
    throw new HsTokenError('HYPHA_MATRIX_AS_HS_TOKEN is not configured', {
      status: 503,
      errcode: 'M_UNKNOWN',
    });
  }
  if (!provided || !constantTimeEquals(provided, expected)) {
    throw new HsTokenError('Invalid hs_token', {
      status: 403,
      errcode: 'M_FORBIDDEN',
    });
  }
}
