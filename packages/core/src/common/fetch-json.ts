/** Error thrown by {@link fetchJson} for a non-2xx response. */
export type HttpError = Error & { status: number };

/**
 * Client fetch helper for SWR fetchers: throws on a non-2xx response instead of
 * handing an error body to the hook as data, and carries the HTTP `status` on
 * the error so a caller (e.g. the SWR provider) can decide whether to retry.
 *
 * A non-JSON body on a 2xx response rejects with the `res.json()` error.
 */
// `T` defaults to `any` like `res.json()`, so call sites keep their current types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchJson<T = any>(
  input: string | URL | Request,
  init?: RequestInit,
  description = 'data',
): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    throw Object.assign(
      new Error(`Failed to fetch ${description}: ${res.statusText}`),
      { status: res.status },
    );
  }
  return (await res.json()) as T;
}
