'use client';

import React from 'react';
import { useMatrix, useMe } from '@hypha-platform/core/client';
import { getSignalTeamMembersFromRoom } from '../utils/signal-team-access';

type UseCanManageSignalArgs = {
  slug?: string | null;
  roomId?: string | null;
  creatorId?: number | null;
};

export function useCanManageSignal({
  slug,
  roomId,
  creatorId,
}: UseCanManageSignalArgs): boolean {
  const { person } = useMe();
  const { client: matrixClient } = useMatrix();
  const currentUserMatrixId = matrixClient?.getUserId?.()?.trim() || null;

  const signalTeamAccess = React.useMemo(() => {
    if (!roomId?.trim()) {
      return { hasPolicy: false, memberMatrixUserIds: [] as string[] };
    }
    return getSignalTeamMembersFromRoom({
      room: matrixClient?.getRoom(roomId.trim()) ?? null,
      coherenceSlug: slug ?? undefined,
    });
  }, [matrixClient, roomId, slug]);

  const isCreator = person?.id != null && person.id === creatorId;
  const isSignalTeamMember = currentUserMatrixId
    ? signalTeamAccess.memberMatrixUserIds.includes(currentUserMatrixId)
    : false;

  return isCreator || (signalTeamAccess.hasPolicy && isSignalTeamMember);
}
