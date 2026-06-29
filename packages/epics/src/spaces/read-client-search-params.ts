'use client';

/** Read live browser query params so client-only URL updates (e.g. map/list toggle via replaceState) are preserved. */
export function readClientSearchParams(
  fallbackSearchParams: URLSearchParams | { toString(): string },
): URLSearchParams {
  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search);
  }
  return new URLSearchParams(fallbackSearchParams.toString());
}
