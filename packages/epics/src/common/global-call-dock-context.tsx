'use client';

import React from 'react';
import {
  setGroupCallSessionActive,
  useSpaceGroupCall,
} from '@hypha-platform/core/client';
import { revalidateSpaceMemoryOrg } from '../coherence/hooks/use-space-memory-org';

type PendingJoin = {
  kind: 'audio' | 'video';
  roomId: string;
  threadRootEventId?: string;
};

type GlobalCallDockMode = 'thumbnail' | 'expanded' | 'fullscreen';
const DOCK_MODE_KEY = 'hypha-global-call-dock-mode-v1';
const CALL_RESUME_KEY = 'hypha-global-call-resume-v1';
const CALL_RESUME_MAX_AGE_MS = 30 * 60 * 1000;

type CallResumeSnapshot = {
  version: 1;
  roomId: string;
  spaceSlug: string | null;
  callKind: PendingJoin['kind'];
  threadRootEventId?: string;
  dockMode: GlobalCallDockMode;
  updatedAt: number;
};

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

function clearCallResumeSnapshot(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CALL_RESUME_KEY);
  } catch {
    // ignore persistence write failure
  }
}

function persistCallResumeSnapshot(snapshot: CallResumeSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CALL_RESUME_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore persistence write failure
  }
}

function readCallResumeSnapshot(): CallResumeSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CALL_RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CallResumeSnapshot>;
    if (
      parsed.version !== 1 ||
      typeof parsed.roomId !== 'string' ||
      !parsed.roomId.trim() ||
      (parsed.callKind !== 'audio' && parsed.callKind !== 'video') ||
      (parsed.dockMode !== 'thumbnail' &&
        parsed.dockMode !== 'expanded' &&
        parsed.dockMode !== 'fullscreen') ||
      typeof parsed.updatedAt !== 'number'
    ) {
      clearCallResumeSnapshot();
      return null;
    }
    if (Date.now() - parsed.updatedAt > CALL_RESUME_MAX_AGE_MS) {
      clearCallResumeSnapshot();
      return null;
    }
    return {
      version: 1,
      roomId: parsed.roomId.trim(),
      spaceSlug: parsed.spaceSlug?.trim() || null,
      callKind: parsed.callKind,
      threadRootEventId: parsed.threadRootEventId?.trim() || undefined,
      dockMode: parsed.dockMode,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    clearCallResumeSnapshot();
    return null;
  }
}

type CallLaunchContext = {
  signalTitle?: string;
  signalSlug?: string;
  threadRootEventId?: string;
  roomTitle?: string;
};

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
  const [dockMode, setDockMode] =
    React.useState<GlobalCallDockMode>('thumbnail');
  const [dockModeHydrated, setDockModeHydrated] = React.useState(false);
  const restoreInProgressRef = React.useRef(false);
  const restoreTimerRef = React.useRef<number | null>(null);
  const callLaunchContextRef = React.useRef<CallLaunchContext | null>(null);
  /** Room pinned for the active call — survives chat panel room/null transitions. */
  const callSessionRoomIdRef = React.useRef<string | null>(null);
  const callSessionSpaceSlugRef = React.useRef<string | null>(null);
  const callSessionAuthTokenRef = React.useRef<string | null>(null);

  const onCallArtifactsUploaded = React.useCallback(
    ({ spaceSlug: slug }: { spaceSlug: string }) => {
      void revalidateSpaceMemoryOrg(slug);
    },
    [],
  );

  const call = useSpaceGroupCall(activeRoomId, {
    authToken: activeAuthToken,
    spaceSlug: activeSpaceSlug,
    onCallArtifactsUploaded,
    getCallLaunchContext: () => callLaunchContextRef.current,
  });

  const inSession =
    call.callState === 'connecting' ||
    call.callState === 'connected' ||
    call.callState === 'awaiting_media' ||
    call.callState === 'initializing' ||
    call.callState === 'disconnecting';
  const inSessionRef = React.useRef(inSession);

  React.useEffect(() => {
    inSessionRef.current = inSession;
  }, [inSession]);

  const bindRoomContext = React.useCallback(
    (
      roomId: string | null,
      spaceSlug: string | null,
      authToken?: string | null,
    ) => {
      if (!roomId) {
        if (
          inSessionRef.current ||
          restoreInProgressRef.current ||
          callSessionRoomIdRef.current
        ) {
          return;
        }
      }
      if (roomId) {
        restoreInProgressRef.current = false;
      }
      setBoundRoomId(roomId);
      setBoundSpaceSlug(spaceSlug);
      setBoundAuthToken(authToken?.trim() || null);
      if (!inSessionRef.current && !callSessionRoomIdRef.current) {
        setActiveRoomId(roomId);
        setActiveSpaceSlug(spaceSlug);
        setActiveAuthToken(authToken?.trim() || null);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (inSession && activeRoomId) {
      callSessionRoomIdRef.current = activeRoomId;
      callSessionSpaceSlugRef.current = activeSpaceSlug;
      callSessionAuthTokenRef.current = activeAuthToken;
      return;
    }
    if (
      call.callState === 'idle' &&
      !pendingJoin &&
      !call.isCallRecovering &&
      !restoreInProgressRef.current
    ) {
      callSessionRoomIdRef.current = null;
      callSessionSpaceSlugRef.current = null;
      callSessionAuthTokenRef.current = null;
    }
  }, [
    activeAuthToken,
    activeRoomId,
    activeSpaceSlug,
    call.callState,
    call.isCallRecovering,
    inSession,
    pendingJoin,
  ]);

  React.useEffect(() => {
    if (
      inSession ||
      pendingJoin ||
      restoreInProgressRef.current ||
      call.isCallRecovering ||
      callSessionRoomIdRef.current
    ) {
      return;
    }
    setActiveRoomId(boundRoomId);
    setActiveSpaceSlug(boundSpaceSlug);
    setActiveAuthToken(boundAuthToken);
  }, [
    boundAuthToken,
    boundRoomId,
    boundSpaceSlug,
    call.isCallRecovering,
    inSession,
    pendingJoin,
  ]);

  React.useEffect(() => {
    if (!activeRoomId || !boundRoomId || activeRoomId !== boundRoomId) return;
    if (activeSpaceSlug !== boundSpaceSlug) {
      setActiveSpaceSlug(boundSpaceSlug);
    }
    if (activeAuthToken !== boundAuthToken) {
      setActiveAuthToken(boundAuthToken);
    }
  }, [
    activeAuthToken,
    activeRoomId,
    activeSpaceSlug,
    boundAuthToken,
    boundRoomId,
    boundSpaceSlug,
  ]);

  React.useEffect(() => {
    if (call.callState === 'idle' && call.recordingStatus !== 'uploading') {
      setDockMode('thumbnail');
    }
  }, [call.callState, call.recordingStatus]);

  React.useEffect(() => {
    const snapshot = readCallResumeSnapshot();
    if (!snapshot) return;
    restoreInProgressRef.current = true;
    setBoundRoomId(snapshot.roomId);
    setBoundSpaceSlug(snapshot.spaceSlug);
    setActiveRoomId(snapshot.roomId);
    setActiveSpaceSlug(snapshot.spaceSlug);
    setPendingJoin({
      kind: snapshot.callKind,
      roomId: snapshot.roomId,
      threadRootEventId: snapshot.threadRootEventId,
    });
    setDockMode(snapshot.dockMode);
    if (restoreTimerRef.current != null) {
      window.clearTimeout(restoreTimerRef.current);
    }
    restoreTimerRef.current = window.setTimeout(() => {
      restoreInProgressRef.current = false;
      restoreTimerRef.current = null;
    }, 15_000);
  }, []);

  React.useEffect(() => {
    if (restoreInProgressRef.current) return;
    setDockMode(readDockModeFromStorage());
    setDockModeHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!dockModeHydrated) return;
    persistDockMode(dockMode);
  }, [dockMode, dockModeHydrated]);

  React.useEffect(() => {
    if (!pendingJoin) return;
    if (activeRoomId !== pendingJoin.roomId) return;
    if (!activeAuthToken) return;

    setPendingJoin(null);
    restoreInProgressRef.current = false;
    if (pendingJoin.kind === 'audio') {
      void call.enterAudio(pendingJoin.threadRootEventId);
      return;
    }
    void call.enterVideo(pendingJoin.threadRootEventId);
  }, [pendingJoin, activeAuthToken, activeRoomId, call]);

  React.useEffect(() => {
    if (
      call.callState === 'connecting' ||
      call.callState === 'connected' ||
      call.callState === 'awaiting_media' ||
      call.callState === 'initializing'
    ) {
      restoreInProgressRef.current = false;
    }
  }, [call.callState]);

  React.useEffect(() => {
    const callKind = pendingJoin?.kind ?? call.callKind;
    if (!activeRoomId || !callKind) {
      if (call.callState === 'idle' && !pendingJoin) {
        clearCallResumeSnapshot();
      }
      return;
    }
    persistCallResumeSnapshot({
      version: 1,
      roomId: activeRoomId,
      spaceSlug: activeSpaceSlug,
      callKind,
      threadRootEventId:
        pendingJoin?.threadRootEventId ?? call.threadContext?.threadRootEventId,
      dockMode,
      updatedAt: Date.now(),
    });
  }, [
    activeRoomId,
    activeSpaceSlug,
    call.callKind,
    call.callState,
    call.threadContext?.threadRootEventId,
    dockMode,
    pendingJoin,
  ]);

  React.useEffect(() => {
    return () => {
      if (restoreTimerRef.current != null) {
        window.clearTimeout(restoreTimerRef.current);
      }
    };
  }, []);

  const startAudioForRoom = React.useCallback(
    async (
      roomId: string | null | undefined,
      spaceSlug?: string | null,
      threadRootEventId?: string,
      authToken?: string | null,
      launchContext?: CallLaunchContext | null,
    ) => {
      const targetRoomId = roomId?.trim();
      if (!targetRoomId) return;
      callLaunchContextRef.current =
        launchContext?.signalTitle?.trim() || launchContext?.roomTitle?.trim()
          ? launchContext
          : threadRootEventId?.trim()
          ? { threadRootEventId: threadRootEventId.trim() }
          : null;
      const targetSpaceSlug = spaceSlug?.trim() ?? null;
      const targetAuthToken = authToken?.trim() || boundAuthToken;
      const pinnedCallRoomId =
        callSessionRoomIdRef.current ??
        (inSessionRef.current ? activeRoomId : null);
      if (pinnedCallRoomId && pinnedCallRoomId !== targetRoomId) {
        return;
      }
      if (activeRoomId !== targetRoomId) {
        setBoundRoomId(targetRoomId);
        setBoundSpaceSlug(targetSpaceSlug);
        setBoundAuthToken(targetAuthToken);
        setActiveRoomId(targetRoomId);
        setActiveSpaceSlug(targetSpaceSlug);
        setActiveAuthToken(targetAuthToken);
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
      authToken?: string | null,
      launchContext?: CallLaunchContext | null,
    ) => {
      const targetRoomId = roomId?.trim();
      if (!targetRoomId) return;
      callLaunchContextRef.current =
        launchContext?.signalTitle?.trim() || launchContext?.roomTitle?.trim()
          ? launchContext
          : threadRootEventId?.trim()
          ? { threadRootEventId: threadRootEventId.trim() }
          : null;
      const targetSpaceSlug = spaceSlug?.trim() ?? null;
      const targetAuthToken = authToken?.trim() || boundAuthToken;
      const pinnedCallRoomId =
        callSessionRoomIdRef.current ??
        (inSessionRef.current ? activeRoomId : null);
      if (pinnedCallRoomId && pinnedCallRoomId !== targetRoomId) {
        return;
      }
      if (activeRoomId !== targetRoomId) {
        setBoundRoomId(targetRoomId);
        setBoundSpaceSlug(targetSpaceSlug);
        setBoundAuthToken(targetAuthToken);
        setActiveRoomId(targetRoomId);
        setActiveSpaceSlug(targetSpaceSlug);
        setActiveAuthToken(targetAuthToken);
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

  const showFloatingDock = inSession || call.recordingStatus === 'uploading';
  const holdsMatrixSyncForCall =
    showFloatingDock ||
    pendingJoin != null ||
    restoreInProgressRef.current ||
    call.isCallRecovering;

  React.useEffect(() => {
    setGroupCallSessionActive(holdsMatrixSyncForCall);
  }, [holdsMatrixSyncForCall]);

  React.useEffect(() => {
    return () => {
      setGroupCallSessionActive(false);
    };
  }, []);

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
