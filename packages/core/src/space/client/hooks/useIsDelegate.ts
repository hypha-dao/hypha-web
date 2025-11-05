'use client';

import { useDelegatesForSpaces } from './useDelegatesForSpaces';
import { useAuthentication } from '@hypha-platform/authentication';
import { useGetDelegators } from './useGetDelegators';
import { useSpaceDetailsWeb3Rpc } from './useSpaceDetails.web3.rpc';

export const useIsDelegate = ({ spaceId }: { spaceId?: number }) => {
  console.log('useIsDelegate called with spaceId:', spaceId);

  const { user } = useAuthentication();
  console.log('User from authentication:', user);

  const {
    data: delegates,
    isLoading,
    error,
  } = useDelegatesForSpaces({
    spaceId: spaceId ? BigInt(spaceId) : undefined,
  });
  console.log('Delegates data:', delegates);
  console.log('Delegates isLoading:', isLoading);
  console.log('Delegates error:', error);

  const {
    data: delegators,
    isLoading: isLoadingDelegators,
    error: delegatorsError,
  } = useGetDelegators({
    user: user?.wallet?.address,
    spaceId: spaceId ? BigInt(spaceId) : undefined,
  });
  console.log('Delegators data:', delegators);
  console.log('Delegators isLoading:', isLoadingDelegators);
  console.log('Delegators error:', delegatorsError);

  const spaceDelegator = delegators?.[0];
  console.log('spaceDelegator (first delegator):', spaceDelegator);

  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: Number(spaceId),
  });
  console.log('spaceDetails:', spaceDetails);

  const spaceMembers = spaceDetails?.members ?? [];
  console.log('spaceMembers:', spaceMembers);

  if (!spaceId) {
    console.log('No spaceId provided, returning default: isDelegate=false');
    return {
      isDelegate: false,
      isLoading: false,
      error: null,
    };
  }

  const userAddress = user?.wallet?.address?.toLowerCase();
  console.log('userAddress (lowercase):', userAddress);

  const isInDelegates = delegates
    ? delegates.some((delegate) => delegate.toLowerCase() === userAddress)
    : false;
  console.log('isInDelegates:', isInDelegates);
  if (delegates) {
    console.log(
      'Delegates (lowercase for comparison):',
      delegates.map((d) => d.toLowerCase()),
    );
  }

  const isDelegatorInMembers = spaceDelegator
    ? spaceMembers.some(
        (member: string) =>
          member?.toLowerCase() === spaceDelegator?.toLowerCase(),
      )
    : false;
  console.log('isDelegatorInMembers:', isDelegatorInMembers);
  if (spaceDelegator) {
    console.log('spaceDelegator (lowercase):', spaceDelegator.toLowerCase());
    console.log(
      'spaceMembers (lowercase for comparison):',
      spaceMembers.map((m) => m.toLowerCase()),
    );
  }

  const isDelegate = isInDelegates && isDelegatorInMembers;
  console.log('Final isDelegate:', isDelegate);

  return {
    isDelegate,
    isLoading: isLoading || isLoadingDelegators,
    error: error || delegatorsError,
  };
};
