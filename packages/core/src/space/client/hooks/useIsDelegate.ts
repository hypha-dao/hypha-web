'use client';

import { useDelegatesForSpaces } from './useDelegatesForSpaces';
import { useAuthentication } from '@hypha-platform/authentication';
import { useGetDelegators } from './useGetDelegators';
import { useSpaceDetailsWeb3Rpc } from './useSpaceDetails.web3.rpc';

export const useIsDelegate = ({
  spaceId,
  userAddress,
}: {
  spaceId?: number;
  userAddress?: `0x${string}`;
}) => {
  const { user } = useAuthentication();

  const targetAddress = userAddress ?? user?.wallet?.address;

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
    user: targetAddress,
    spaceId: spaceId ? BigInt(spaceId) : undefined,
  });

  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: Number(spaceId),
  });

  const spaceMembers = spaceDetails?.members ?? [];

  if (!spaceId || !targetAddress) {
    return {
      isDelegate: false,
      isLoading: false,
      error: null,
    };
  }

  const lowerTargetAddress = targetAddress.toLowerCase();

  const isInDelegates = delegates
    ? delegates.some(
        (delegate) => delegate.toLowerCase() === lowerTargetAddress,
      )
    : false;

  const isDelegatorInMembers = delegators
    ? delegators.some((delegator: `0x${string}`) =>
        spaceMembers.some(
          (member: string) =>
            member?.toLowerCase() === delegator?.toLowerCase(),
        ),
      )
    : false;

  const isDelegate = isInDelegates && isDelegatorInMembers;

  return {
    isDelegate,
    isLoading: isLoading || isLoadingDelegators,
    error: error || delegatorsError,
  };
};
