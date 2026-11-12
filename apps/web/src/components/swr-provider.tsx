'use client';

import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';

/** Statuses a retry cannot fix (refused or missing): do not retry them. */
const NO_RETRY_STATUSES = new Set([401, 403, 404]);

/**
 * App-wide SWR defaults.
 *
 * The app had no global `SWRConfig`, so every hook fell back to SWR's built-in
 * defaults (2s dedupe, unbounded error retries). Centralizing here lets us:
 *  - collapse the many duplicate `/api/v1/spaces/{slug}`, `/me`, documents
 *    requests that fire from the layout, the top menu, access wrappers and tab
 *    components as the page hydrates (`dedupingInterval`);
 *  - bound error-retry storms so a transiently failing/invalid request can't
 *    hammer the network (`errorRetryCount`).
 *
 * Deliberately NOT set globally:
 *  - `refreshInterval`: polling stays opt-in per hook.
 *  - `keepPreviousData`: kept per-hook so navigating between different
 *    resources (e.g. two spaces) doesn't briefly show the previous one's data.
 *
 * `skipClientErrorRetry` (white-label tree only): a call the mapped host does
 * not serve answers 404, and retrying it never helps. Only errors that carry a
 * `status` (as `useEvents` does) are affected; the main app does not set it.
 */
export function SwrProvider({
  children,
  skipClientErrorRetry = false,
}: {
  children: ReactNode;
  skipClientErrorRetry?: boolean;
}) {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 5000,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        errorRetryCount: 3,
        ...(skipClientErrorRetry
          ? {
              onErrorRetry: (error, _key, config, revalidate, opts) => {
                const status = (error as { status?: unknown } | null)?.status;
                if (typeof status === 'number' && NO_RETRY_STATUSES.has(status))
                  return;
                const max = config.errorRetryCount;
                if (max !== undefined && opts.retryCount > max) return;
                setTimeout(
                  () => revalidate(opts),
                  Math.round((Math.random() + 0.5) * 2 ** opts.retryCount) *
                    config.errorRetryInterval,
                );
              },
            }
          : {}),
      }}
    >
      {children}
    </SWRConfig>
  );
}
