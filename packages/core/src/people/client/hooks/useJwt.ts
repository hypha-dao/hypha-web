'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import useSWR from 'swr';

export const useJwt = () => {
  const { getAccessToken, user } = useAuthentication();
  const { data: jwt, isLoading: isLoadingJwt } = useSWR(
    user?.id ? [user.id, 'jwt'] : null,
    () => getAccessToken(),
    { refreshInterval: 1000 },
  );

  return { jwt, isLoadingJwt };
};
