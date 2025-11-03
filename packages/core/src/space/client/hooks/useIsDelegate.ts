'use client';

import { useDelegatesForSpaces } from './useDelegatesForSpaces';
import { useAuthentication } from '@hypha-platform/authentication';
import { useGetDelegators } from './useGetDelegators';
import { useSpaceDetailsWeb3Rpc } from './useSpaceDetails.web3.rpc';

export const useIsDelegate = ({ spaceId }: { spaceId?: number }) => {
  const { user } = useAuthentication();

  const {
    data: delegates,
    isLoading,
    error,
  } = useDelegatesForSpaces({
    spaceId: spaceId ? BigInt(spaceId) : undefined,
  });

  const {
    data: delegators,
    isLoading: isLoadingDelegators,
    error: delegatorsError,
  } = useGetDelegators({
    user: user?.wallet?.address,
    spaceId: spaceId ? BigInt(spaceId) : undefined,
  });

  const spaceDelegator = delegators?.[0];

  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: Number(spaceId),
  });

  const spaceMembers = spaceDetails?.members ?? [];

  if (!spaceId) {
    return {
      isDelegate: false,
      isLoading: false,
      error: null,
    };
  }

  const userAddress = user?.wallet?.address?.toLowerCase();

  const isInDelegates = delegates
    ? delegates.some((delegate) => delegate.toLowerCase() === userAddress)
    : false;

  const isDelegatorInMembers = spaceDelegator
    ? spaceMembers.some(
        (member: string) =>
          member?.toLowerCase() === spaceDelegator?.toLowerCase(),
      )
    : false;

  const isDelegate = isInDelegates && isDelegatorInMembers;

  return {
    isDelegate,
    isLoading: isLoading || isLoadingDelegators,
    error: error || delegatorsError,
  };
};
