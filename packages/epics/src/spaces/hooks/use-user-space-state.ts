'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useSpaceMember } from './use-space-member';
import { useIsDelegate } from '@hypha-platform/core/client';
import { useSpaceBySlug, Space } from '@hypha-platform/core/client';
import { useMemo } from 'react';
import useSWR from 'swr';

export enum UserSpaceState {
  NOT_LOGGED_IN = 'NOT_LOGGED_IN',
  LOGGED_IN = 'LOGGED_IN',
  LOGGED_IN_ORG = 'LOGGED_IN_ORG',
  LOGGED_IN_SPACE = 'LOGGED_IN_SPACE',
}

export function useUserSpaceState({
  spaceId,
  spaceSlug,
  space,
}: {
  spaceId?: number;
  spaceSlug?: string;
  space?: Space | null;
}): {
  userState: UserSpaceState;
  isLoading: boolean;
} {
  const { isAuthenticated, user } = useAuthentication();
  const spaceFromHook = useSpaceBySlug(spaceSlug || '');
  const effectiveSpace = space || spaceFromHook.space;
  const effectiveSpaceId = spaceId || effectiveSpace?.web3SpaceId;

  const { isMember, isMemberLoading } = useSpaceMember({
    spaceId: effectiveSpaceId as number,
  });

  const { isDelegate, isLoading: isDelegateLoading } = useIsDelegate({
    spaceId: effectiveSpaceId as number,
    userAddress: user?.wallet?.address,
  });

  const parentSpaceId = effectiveSpace?.parentId;
  const { data: parentSpace, isLoading: isParentSpaceLoading } = useSWR(
    parentSpaceId ? [`/api/v1/spaces/${parentSpaceId}`, 'parentSpace'] : null,
    async ([url]) => {
      const res = await fetch(url);
      if (!res.ok) return null;
      return (await res.json()) as Space | null;
    },
  );

  const { isMember: isOrgMember, isMemberLoading: isOrgMemberLoading } =
    useSpaceMember({
      spaceId: parentSpace?.web3SpaceId as number,
    });

  const { isDelegate: isOrgDelegate, isLoading: isOrgDelegateLoading } =
    useIsDelegate({
      spaceId: parentSpace?.web3SpaceId as number,
      userAddress: user?.wallet?.address,
    });

  const userState = useMemo(() => {
    if (!isAuthenticated || !user) {
      return UserSpaceState.NOT_LOGGED_IN;
    }

    if (isMember || isDelegate) {
      return UserSpaceState.LOGGED_IN_SPACE;
    }

    if (isOrgMember || isOrgDelegate) {
      return UserSpaceState.LOGGED_IN_ORG;
    }

    return UserSpaceState.LOGGED_IN;
  }, [isAuthenticated, user, isMember, isDelegate, isOrgMember, isOrgDelegate]);

  const isLoading =
    isMemberLoading ||
    isDelegateLoading ||
    isParentSpaceLoading ||
    isOrgMemberLoading ||
    isOrgDelegateLoading ||
    spaceFromHook.isLoading;

  return {
    userState,
    isLoading,
  };
}
