import type { Failure } from '../access/failure';
import type { Caller } from '../access/caller';

/** The API's own view of a caller: the same type as the access layer's. */
export type V2Caller = Caller;

export type V2Failure = {
  ok: false;
  status: 400 | 401 | 403 | 404 | 429 | 500 | 502;
  error: string;
  message?: string;
};

/** Maps a feature function's neutral failure code to the API's HTTP presentation. */
export function toV2Failure(f: Failure): V2Failure {
  const base = (status: V2Failure['status'], error: string): V2Failure => ({
    ok: false,
    status,
    error,
    ...(f.message ? { message: f.message } : {}),
  });
  switch (f.code) {
    case 'unauthenticated':
      return base(401, 'Authentication required');
    case 'invalid_identity':
      return base(401, 'Invalid authentication');
    case 'no_profile':
      return base(403, 'A Hypha profile is required');
    case 'forbidden':
      return base(403, 'Access denied');
    case 'not_found':
      return base(404, 'Space not found');
    case 'chain_read_failed':
      return base(502, 'Chain read failed');
    case 'access_check_failed':
      return base(500, 'Failed to verify access');
    case 'invalid_input':
      return base(400, 'Invalid input');
    case 'rate_limited':
      return base(429, 'Too many requests');
  }
}
