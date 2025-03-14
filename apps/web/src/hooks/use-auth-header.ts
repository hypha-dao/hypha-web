import { useJwt } from './use-jwt';

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
