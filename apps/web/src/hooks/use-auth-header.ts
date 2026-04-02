import { useJwt } from '@hypha-platform/core/client';

export const useAuthHeader = () => {
  const { jwt, isLoadingJwt } = useJwt();
  return {
    headers: jwt
      ? {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    isLoading: isLoadingJwt,
  };
};
