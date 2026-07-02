'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import useSWR from 'swr';

export const useJwt = () => {
  const { getAccessToken, user, isAuthenticated } = useAuthentication();
  const { data: jwt, isLoading: isLoadingJwt } = useSWR(
    isAuthenticated && user?.id ? [user.id, 'jwt'] : null,
    () => getAccessToken(),
    {
      // Privy returns a cached token and only refreshes it when it is close to
      // expiry, so there is no need to poll every second. Refreshing every few
      // minutes keeps the token fresh without causing every `useJwt` consumer
      // to re-render (and dependent SWR keys to churn) once per second.
      refreshInterval: 5 * 60 * 1000,
      revalidateOnFocus: true,
      dedupingInterval: 60 * 1000,
    },
  );

  return { jwt, isLoadingJwt };
};
