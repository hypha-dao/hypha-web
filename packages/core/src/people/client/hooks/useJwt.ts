'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import useSWR from 'swr';

export const useJwt = () => {
  const { getAccessToken, user, isAuthenticated, isLoading } =
    useAuthentication();
  const { data: jwt, isLoading: isLoadingJwt } = useSWR(
    !isLoading && isAuthenticated && user?.id ? [user.id, 'jwt'] : null,
    async () => {
      const token = await getAccessToken();
      // Privy can report `authenticated` before the first Bearer token exists
      // (typical for brand-new email/Gmail signups). Caching `null` would
      // skip `/me` until the 5-minute refresh and look like "no profile".
      if (!token) {
        throw new Error('Access token not ready');
      }
      return token;
    },
    {
      // Privy returns a cached token and only refreshes it when it is close to
      // expiry, so there is no need to poll every second. Refreshing every few
      // minutes keeps the token fresh without causing every `useJwt` consumer
      // to re-render (and dependent SWR keys to churn) once per second.
      refreshInterval: 5 * 60 * 1000,
      revalidateOnFocus: true,
      dedupingInterval: 60 * 1000,
      // Auth loading can briefly null the key; keep the last token so every
      // `[endpoint, jwt]` consumer does not flash empty and refetch as uncached.
      keepPreviousData: true,
    },
  );

  return {
    jwt,
    isLoadingJwt:
      isLoading || isLoadingJwt || Boolean(isAuthenticated && user?.id && !jwt),
  };
};
