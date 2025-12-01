'use client';

import { useMe, useRemoveMemberWeb3Rpc } from '@hypha-platform/core/client';
import React from 'react';

export const useExitSpace = ({ spaceId }: { spaceId: number }) => {
  const { person, isLoading } = useMe();

  const { removeMember, isRemovingMember: isExitingSpace } =
    useRemoveMemberWeb3Rpc();

  const exitSpace = React.useCallback(async () => {
    if (!Number.isSafeInteger(spaceId) || (spaceId as number) < 0) {
      throw new Error('spaceId is required to exit the space');
    }
    if (isLoading || !person?.address) {
      throw new Error('person with address is required to exit the space');
    }
    return await removeMember({
      spaceId: spaceId as number,
      memberAddress: person.address as `0x${string}`,
    });
  }, [removeMember, spaceId, person, isLoading]);

  return {
    isExitingSpace,
    exitSpace,
    isDisabled: Boolean(isLoading || !person?.address),
  };
};
