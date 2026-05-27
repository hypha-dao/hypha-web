'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  isGroupCallSessionActive,
  subscribeGroupCallSessionActive,
} from './active-group-call-registry';
import {
  MatrixTabLeaderCoordinator,
  type MatrixTabLeaderSnapshot,
} from '../matrix-tab-leader';

export function useMatrixTabLeader(): {
  isSyncLeader: boolean;
  claimSyncLeadership: () => void;
} {
  const coordinatorRef = useRef<MatrixTabLeaderCoordinator | null>(null);
  const [snapshot, setSnapshot] = useState<MatrixTabLeaderSnapshot>(() => ({
    isSyncLeader: typeof BroadcastChannel === 'undefined',
    leaderTabId: null,
  }));

  useEffect(() => {
    const coordinator = new MatrixTabLeaderCoordinator({
      holdLeadershipWhile: isGroupCallSessionActive,
    });
    coordinatorRef.current = coordinator;
    const unsubscribe = coordinator.subscribe(setSnapshot);
    const unsubscribeCallGuard = subscribeGroupCallSessionActive(() => {
      setSnapshot(coordinator.getSnapshot());
    });
    return () => {
      unsubscribeCallGuard();
      unsubscribe();
      coordinator.dispose();
      coordinatorRef.current = null;
    };
  }, []);

  const claimSyncLeadership = useCallback(() => {
    coordinatorRef.current?.claimSyncLeadership();
  }, []);

  return {
    isSyncLeader: snapshot.isSyncLeader,
    claimSyncLeadership,
  };
}
