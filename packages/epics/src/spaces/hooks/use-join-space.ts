'use client';

import { useJoinSpaceWeb3Rpc } from '@hypha-platform/core/client';
import React from 'react';

export const useJoinSpace = ({ spaceId }: { spaceId?: number }) => {
  const { joinSpace: joinSpaceWeb3, isJoiningSpace } = useJoinSpaceWeb3Rpc({
    spaceId: spaceId as number,
  });

  const joinSpace = React.useCallback(async () => {
    if (!Number.isSafeInteger(spaceId) || (spaceId as number) < 0) {
      throw new Error('spaceId is required to join a space');
    }
    return joinSpaceWeb3();
  }, [joinSpaceWeb3, spaceId]);

  return {
    isJoiningSpace,
    joinSpace,
  };
};
