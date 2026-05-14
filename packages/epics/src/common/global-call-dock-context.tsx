'use client';

import React from 'react';
import { useSpaceGroupCall } from '@hypha-platform/core/client';

type PendingJoin = {
  kind: 'audio' | 'video';
  roomId: string;
  threadRootEventId?: string;
};

type GlobalCallDockMode = 'thumbnail' | 'expanded' | 'fullscreen';
const DOCK_MODE_KEY = 'hypha-global-call-dock-mode-v1';

function readDockModeFromStorage(): GlobalCallDockMode {
  if (typeof window === 'undefined') return 'thumbnail';
  try {
    const raw = window.localStorage.getItem(DOCK_MODE_KEY)?.trim();
    if (raw === 'thumbnail' || raw === 'expanded' || raw === 'fullscreen') {
      return raw;
    }
  } catch {
    // ignore storage read failure
  }
  return 'thumbnail';
}

function persistDockMode(mode: GlobalCallDockMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DOCK_MODE_KEY, mode);
  } catch {
    // ignore storage write failure
  }
}

type GlobalCallDockContextValue = ReturnType<typeof useGlobalCallDockValue>;

const GlobalCallDockContext =
  React.createContext<GlobalCallDockContextValue | null>(null);

function useGlobalCallDockValue() {
  const [boundRoomId, setBoundRoomId] = React.useState<string | null>(null);
  const [boundSpaceSlug, setBoundSpaceSlug] = React.useState<string | null>(
    null,
  );
  const [boundAuthToken, setBoundAuthToken] = React.useState<string | null>(
    null,
  );
  const [activeRoomId, setActiveRoomId] = React.useState<string | null>(null);
  const [activeSpaceSlug, setActiveSpaceSlug] = React.useState<string | null>(
    null,
  );
  const [activeAuthToken, setActiveAuthToken] = React.useState<string | null>(
    null,
  );
  const [pendingJoin, setPendingJoin] = React.useState<PendingJoin | null>(
    null,
  );
  const [dockMode, setDockMode] = React.useState<GlobalCallDockMode>(() =>
    readDockModeFromStorage(),
  );

  const call = useSpaceGroupCall(activeRoomId, {
    authToken: activeAuthToken,
    spaceSlug: activeSpaceSlug,
  });

  const inSession =
    call.callState === 'connecting' ||
    call.callState === 'connected' ||
    call.callState === 'awaiting_media' ||
    call.callState === 'initializing' ||
    call.callState === 'disconnecting';

  const bindRoomContext = React.useCallback(
    (
      roomId: string | null,
      spaceSlug: string | null,
      authToken?: string | null,
    ) => {
      setBoundRoomId(roomId);
      setBoundSpaceSlug(spaceSlug);
      setBoundAuthToken(authToken?.trim() || null);
      if (!inSession) {
        setActiveRoomId(roomId);
        setActiveSpaceSlug(spaceSlug);
        setActiveAuthToken(authToken?.trim() || null);
      }
    },
    [inSession],
  );

  React.useEffect(() => {
    if (!inSession) {
      setActiveRoomId(boundRoomId);
      setActiveSpaceSlug(boundSpaceSlug);
      setActiveAuthToken(boundAuthToken);
    }
  }, [inSession, boundAuthToken, boundRoomId, boundSpaceSlug]);

  React.useEffect(() => {
    if (call.callState === 'idle') {
      setDockMode('thumbnail');
    }
  }, [call.callState]);

  React.useEffect(() => {
    persistDockMode(dockMode);
  }, [dockMode]);

  React.useEffect(() => {
    if (!pendingJoin) return;
    if (activeRoomId !== pendingJoin.roomId) return;

    setPendingJoin(null);
    if (pendingJoin.kind === 'audio') {
      void call.enterAudio(pendingJoin.threadRootEventId);
      return;
    }
    void call.enterVideo(pendingJoin.threadRootEventId);
  }, [pendingJoin, activeRoomId, call]);

  const startAudioForRoom = React.useCallback(
    async (
      roomId: string | null | undefined,
      spaceSlug?: string | null,
      threadRootEventId?: string,
    ) => {
      const targetRoomId = roomId?.trim();
      if (!targetRoomId) return;
      const targetSpaceSlug = spaceSlug?.trim() ?? null;
      if (activeRoomId !== targetRoomId) {
        setBoundRoomId(targetRoomId);
        setBoundSpaceSlug(targetSpaceSlug);
        setBoundAuthToken(boundAuthToken);
        setActiveRoomId(targetRoomId);
        setActiveSpaceSlug(targetSpaceSlug);
        setActiveAuthToken(boundAuthToken);
        setPendingJoin({
          kind: 'audio',
          roomId: targetRoomId,
          threadRootEventId,
        });
        return;
      }
      await call.enterAudio(threadRootEventId);
    },
    [activeRoomId, boundAuthToken, call],
  );

  const startVideoForRoom = React.useCallback(
    async (
      roomId: string | null | undefined,
      spaceSlug?: string | null,
      threadRootEventId?: string,
    ) => {
      const targetRoomId = roomId?.trim();
      if (!targetRoomId) return;
      const targetSpaceSlug = spaceSlug?.trim() ?? null;
      if (activeRoomId !== targetRoomId) {
        setBoundRoomId(targetRoomId);
        setBoundSpaceSlug(targetSpaceSlug);
        setBoundAuthToken(boundAuthToken);
        setActiveRoomId(targetRoomId);
        setActiveSpaceSlug(targetSpaceSlug);
        setActiveAuthToken(boundAuthToken);
        setPendingJoin({
          kind: 'video',
          roomId: targetRoomId,
          threadRootEventId,
        });
        return;
      }
      await call.enterVideo(threadRootEventId);
    },
    [activeRoomId, boundAuthToken, call],
  );

  const showFloatingDock = call.callState !== 'idle';

  return {
    bindRoomContext,
    boundRoomId,
    activeRoomId,
    activeSpaceSlug,
    dockMode,
    setDockMode,
    showFloatingDock,
    startAudioForRoom,
    startVideoForRoom,
    ...call,
  };
}

export function GlobalCallDockProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useGlobalCallDockValue();
  return (
    <GlobalCallDockContext.Provider value={value}>
      {children}
    </GlobalCallDockContext.Provider>
  );
}

export function useGlobalCallDock() {
  const value = React.useContext(GlobalCallDockContext);
  if (!value) {
    throw new Error(
      'useGlobalCallDock must be used within GlobalCallDockProvider',
    );
  }
  return value;
}
