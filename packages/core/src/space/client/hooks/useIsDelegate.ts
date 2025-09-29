'use client';

import { useDelegatesForSpaces } from './useDelegatesForSpaces';
import { useAuthentication } from '@hypha-platform/authentication';

export const useIsDelegate = ({ spaceId }: { spaceId?: number }) => {
  const { user } = useAuthentication();

  const {
    data: delegates,
    isLoading,
    error,
  } = useDelegatesForSpaces({
    spaceId: spaceId ? BigInt(spaceId) : undefined,
  });

  if (!spaceId) {
    return {
      isDelegate: false,
      isLoading: false,
      error: null,
    };
  }

  const isDelegate = delegates
    ? delegates.some(
        (delegate) =>
          delegate.toLowerCase() === user?.wallet?.address.toLowerCase(),
      )
    : false;

  return {
    isDelegate,
    isLoading,
    error,
  };
};
