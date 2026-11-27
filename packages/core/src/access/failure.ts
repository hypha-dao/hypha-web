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
  | 'chain_read_failed'
  /** The input of a write was refused; `message` says which rule, never echoing the input. */
  | 'invalid_input'
  /** Too many writes in a short time; `retryAfterSeconds` says when to try again. */
  | 'rate_limited';

export type Failure = {
  ok: false;
  code: FailureCode;
  message?: string;
  /** Set with `rate_limited` only. */
  retryAfterSeconds?: number;
};

export const failure = (
  code: FailureCode,
  message?: string,
  extra: { retryAfterSeconds?: number } = {},
): Failure => ({
  ok: false,
  code,
  ...(message ? { message } : {}),
  ...(extra.retryAfterSeconds !== undefined
    ? { retryAfterSeconds: extra.retryAfterSeconds }
    : {}),
});
