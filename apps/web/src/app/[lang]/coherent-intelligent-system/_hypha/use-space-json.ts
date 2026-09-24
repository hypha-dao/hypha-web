'use client';

import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

/**
 * #2486 — thin authed JSON reader for the widget adapters. The full epic
 * sections (`AssetsSection`, `DocumentsSections`) read the space slug from
 * `useParams().id` and pull in web3-RPC / member-state hooks sized for a route
 * column (spec §5.3 invariant #1). The canvas widgets instead hit the same REST
 * routes directly with an explicit `spaceSlug` and render a compact read view.
 */
export function useSpaceJson<T>(path: string | null): {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
} {
  const { getAccessToken } = useAuthentication();
  const { data, isLoading, error } = useSWR(
    path ? [path] : null,
    async ([endpoint]: [string]) => {
      const token = await getAccessToken();
      const headers: HeadersInit = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(endpoint, { headers });
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status} ${res.statusText}`);
      }
      return (await res.json()) as T;
    },
    { refreshInterval: 30000 },
  );
  return { data, isLoading, error };
}
