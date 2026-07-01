'use client';

import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';

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
 */
export function SwrProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 5000,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        errorRetryCount: 3,
      }}
    >
      {children}
    </SWRConfig>
  );
}
