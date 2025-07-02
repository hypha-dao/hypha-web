import { useJwt } from '@hypha-platform/core/client';

export const useAuthHeader = () => {
  const { jwt, isLoadingJwt } = useJwt();
  return {
    headers: jwt
      ? {
          Authorization: `Bearer ${jwt}`,
        }
      : undefined,
    isLoading: isLoadingJwt,
  };
};
