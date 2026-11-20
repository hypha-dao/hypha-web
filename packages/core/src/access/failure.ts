/**
 * Expected failures of a feature function (R15): returned, never thrown. The code is
 * neutral; each channel maps it to its own presentation (an HTTP status for the API, a
 * tool error for the MCP). `message` is plain, safe English; never raw exception text.
 */
export type FailureCode =
  /** Needs a verified user and the caller is a guest. */
  | 'unauthenticated'
  /** A user, but the identity cannot be established (no wallet address). */
  | 'invalid_identity'
  /** The caller has no profile (MCP: a clear tool error). */
  | 'no_profile'
  /** Visible to some, not to this caller. */
  | 'forbidden'
  /** Unknown, or not visible to this caller; same answer by design. */
  | 'not_found'
  /** An access fact could not be read, so access fails closed. */
  | 'access_check_failed'
  /** A chain read for the answer itself failed. */
  | 'chain_read_failed';

export type Failure = { ok: false; code: FailureCode; message?: string };

export const failure = (code: FailureCode, message?: string): Failure => ({
  ok: false,
  code,
  ...(message ? { message } : {}),
});
