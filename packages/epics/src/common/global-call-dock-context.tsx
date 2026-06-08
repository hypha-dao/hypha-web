'use client';

import React from 'react';
import {
  setGroupCallSessionActive,
  useMatrix,
  useSpaceGroupCall,
} from '@hypha-platform/core/client';
import { revalidateSpaceMemoryOrg } from '../coherence/hooks/use-space-memory-org';
import { useCallReactions } from './human-chat-panel/use-call-reactions';
import { resumeCallPlayback } from './human-chat-panel/call-playback-registry';
import {
  clearCallDismissedByUser,
  clearCallResumeSnapshot,
  markCallDismissedByUser,
  persistCallResumeSnapshot,
  readCallResumeSnapshot,
  shouldPersistCallResumeSnapshot,
  type CallResumeSnapshot,
  type GlobalCallDockMode,
} from './global-call-resume-storage';

type PendingJoin = {
  kind: 'audio' | 'video';
  roomId: string;
  threadRootEventId?: string;
};

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

type CallLaunchContext = {
  signalTitle?: string;
  signalSlug?: string;
  threadRootEventId?: string;
  roomTitle?: string;
};

type GlobalCallDockContextValue = ReturnType<typeof useGlobalCallDockValue>;

const GlobalCallDockContext =
  React.createContext<GlobalCallDockContextValue | null>(null);

function applyCallResumeSnapshot(
  snapshot: CallResumeSnapshot,
  apply: {
    setBoundRoomId: (roomId: string) => void;
    setBoundSpaceSlug: (spaceSlug: string | null) => void;
    setActiveRoomId: (roomId: string) => void;
    setActiveSpaceSlug: (spaceSlug: string | null) => void;
    setPinnedCallSpaceSlug: (spaceSlug: string | null) => void;
    setPendingJoin: (join: PendingJoin) => void;
    setDockMode: (mode: GlobalCallDockMode) => void;
    callLaunchContextRef: React.MutableRefObject<CallLaunchContext | null>;
    restoreInProgressRef: React.MutableRefObject<boolean>;
    restoreTimerRef: React.MutableRefObject<number | null>;
  },
): void {
  apply.restoreInProgressRef.current = true;
  apply.setBoundRoomId(snapshot.roomId);
  apply.setBoundSpaceSlug(snapshot.spaceSlug);
  apply.setActiveRoomId(snapshot.roomId);
  apply.setActiveSpaceSlug(snapshot.spaceSlug);
  apply.setPinnedCallSpaceSlug(snapshot.spaceSlug);
  apply.setPendingJoin({
    kind: snapshot.callKind,
    roomId: snapshot.roomId,
    threadRootEventId: snapshot.threadRootEventId,
  });
  if (
    snapshot.signalTitle?.trim() ||
    snapshot.signalSlug?.trim() ||
    snapshot.roomTitle?.trim() ||
    snapshot.threadRootEventId?.trim()
  ) {
    apply.callLaunchContextRef.current = {
      signalTitle: snapshot.signalTitle?.trim() || undefined,
      signalSlug: snapshot.signalSlug?.trim() || undefined,
      roomTitle: snapshot.roomTitle?.trim() || undefined,
      threadRootEventId: snapshot.threadRootEventId?.trim() || undefined,
    };
  }
  apply.setDockMode(snapshot.dockMode);
  if (apply.restoreTimerRef.current != null) {
    window.clearTimeout(apply.restoreTimerRef.current);
  }
  apply.restoreTimerRef.current = window.setTimeout(() => {
    apply.restoreInProgressRef.current = false;
    apply.restoreTimerRef.current = null;
  }, 15_000);
}

function useGlobalCallDockValue() {
  const { isMatrixSyncLeader, client } = useMatrix();
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
  const [pinnedCallSpaceSlug, setPinnedCallSpaceSlug] = React.useState<
    string | null
  >(null);
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
  const resumeAttemptAtRef = React.useRef<number | null>(null);
  const resumeAttemptKeyRef = React.useRef<string | null>(null);
  const releasingForTransferRef = React.useRef(false);
  const lastPersistedResumeSignatureRef = React.useRef<string | null>(null);
  /** Blocks resume/pending-join after an explicit hang-up (same tab, same render). */
  const userDismissedCallRef = React.useRef(false);
  const wasMatrixSyncLeaderRef = React.useRef(isMatrixSyncLeader);
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
  const currentUserId = client?.getUserId() ?? null;
  const callReactions = useCallReactions({
    client,
    roomId: activeRoomId,
    anchorEventId: call.callSessionAnchorEventId,
    groupCallId: call.groupCall?.groupCallId ?? null,
    callState: call.callState,
    currentUserId,
    inCallUserIds: call.inCallUserIdsForRoster,
    pinnedCallSpaceSlug,
    boundSpaceSlug,
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
      const prevSessionRoomId = callSessionRoomIdRef.current;
      callSessionRoomIdRef.current = activeRoomId;
      callSessionAuthTokenRef.current = activeAuthToken;

      if (prevSessionRoomId !== activeRoomId) {
        const slugToPin = activeSpaceSlug?.trim() || null;
        if (slugToPin) {
          callSessionSpaceSlugRef.current = slugToPin;
          setPinnedCallSpaceSlug(slugToPin);
        }
      } else if (!callSessionSpaceSlugRef.current && activeSpaceSlug?.trim()) {
        callSessionSpaceSlugRef.current = activeSpaceSlug.trim();
        setPinnedCallSpaceSlug(activeSpaceSlug.trim());
      }
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
      setPinnedCallSpaceSlug(null);
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
    if (!isMatrixSyncLeader) return;
    if (inSession || pendingJoin) return;
    if (userDismissedCallRef.current) return;
    const snapshot = readCallResumeSnapshot();
    if (!snapshot) return;
    const attemptKey = `${snapshot.roomId}:${snapshot.callKind}:${snapshot.updatedAt}`;
    if (resumeAttemptKeyRef.current === attemptKey) return;
    resumeAttemptKeyRef.current = attemptKey;
    resumeAttemptAtRef.current = snapshot.updatedAt;
    applyCallResumeSnapshot(snapshot, {
      setBoundRoomId,
      setBoundSpaceSlug,
      setActiveRoomId,
      setActiveSpaceSlug,
      setPinnedCallSpaceSlug,
      setPendingJoin,
      setDockMode,
      callLaunchContextRef,
      restoreInProgressRef,
      restoreTimerRef,
    });
  }, [inSession, isMatrixSyncLeader, pendingJoin]);

  React.useEffect(() => {
    if (isMatrixSyncLeader && !wasMatrixSyncLeaderRef.current) {
      resumeAttemptKeyRef.current = null;
      if (call.callState === 'error' && call.errorCode === 'NO_CLIENT') {
        call.dismissCallError();
      }
    }
    if (wasMatrixSyncLeaderRef.current && !isMatrixSyncLeader) {
      resumeAttemptAtRef.current = null;
      resumeAttemptKeyRef.current = null;
      restoreInProgressRef.current = false;
      setPendingJoin(null);
      if (inSessionRef.current) {
        setIsReleasingForTransfer(true);
        releasingForTransferRef.current = true;
        void call.releaseLocalCallForTabTransfer().finally(() => {
          releasingForTransferRef.current = false;
          setIsReleasingForTransfer(false);
        });
      }
    }
    wasMatrixSyncLeaderRef.current = isMatrixSyncLeader;
  }, [
    call.dismissCallError,
    call.callState,
    call.errorCode,
    call.releaseLocalCallForTabTransfer,
    isMatrixSyncLeader,
  ]);

  React.useEffect(() => {
    if (restoreInProgressRef.current) return;
    setDockMode(readDockModeFromStorage());
    setDockModeHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!dockModeHydrated) return;
    persistDockMode(dockMode);
  }, [dockMode, dockModeHydrated]);

  const enterAudio = call.enterAudio;
  const enterVideo = call.enterVideo;

  React.useEffect(() => {
    if (!pendingJoin) return;
    if (userDismissedCallRef.current) {
      setPendingJoin(null);
      return;
    }
    if (!isMatrixSyncLeader || !client) return;
    if (activeRoomId !== pendingJoin.roomId) return;
    if (!activeAuthToken) return;

    const join = pendingJoin;
    setPendingJoin(null);
    restoreInProgressRef.current = false;
    if (join.kind === 'audio') {
      void enterAudio(join.threadRootEventId);
      return;
    }
    void enterVideo(join.threadRootEventId);
  }, [
    pendingJoin,
    activeAuthToken,
    activeRoomId,
    client,
    enterAudio,
    enterVideo,
    isMatrixSyncLeader,
  ]);

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
    if (restoreInProgressRef.current) {
      return;
    }
    if (call.callState === 'disconnecting') {
      return;
    }
    if (activeRoomId && !shouldPersistCallResumeSnapshot(activeRoomId)) {
      clearCallResumeSnapshot();
      return;
    }
    const callKind = pendingJoin?.kind ?? call.callKind;
    if (!activeRoomId || !callKind) {
      if (isMatrixSyncLeader && call.callState === 'idle' && !pendingJoin) {
        clearCallResumeSnapshot();
      }
      return;
    }
    const launchContext = callLaunchContextRef.current;
    const threadRootEventId =
      pendingJoin?.threadRootEventId ?? call.threadContext?.threadRootEventId;
    const persistSignature = [
      activeRoomId,
      callKind,
      activeSpaceSlug ?? '',
      dockMode,
      threadRootEventId ?? '',
    ].join('|');
    if (lastPersistedResumeSignatureRef.current === persistSignature) {
      return;
    }
    lastPersistedResumeSignatureRef.current = persistSignature;
    persistCallResumeSnapshot({
      version: 1,
      roomId: activeRoomId,
      spaceSlug: activeSpaceSlug,
      callKind,
      threadRootEventId,
      dockMode,
      updatedAt: Date.now(),
      signalTitle: launchContext?.signalTitle?.trim() || undefined,
      signalSlug: launchContext?.signalSlug?.trim() || undefined,
      roomTitle: launchContext?.roomTitle?.trim() || undefined,
    });
  }, [
    activeRoomId,
    activeSpaceSlug,
    call.callKind,
    call.callState,
    call.threadContext?.threadRootEventId,
    dockMode,
    isMatrixSyncLeader,
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
      userDismissedCallRef.current = false;
      clearCallDismissedByUser();
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
      userDismissedCallRef.current = false;
      clearCallDismissedByUser();
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

  const leaveCall = React.useCallback(async () => {
    const dismissedRoomId =
      activeRoomId?.trim() ||
      callSessionRoomIdRef.current?.trim() ||
      boundRoomId?.trim() ||
      null;
    userDismissedCallRef.current = true;
    markCallDismissedByUser(dismissedRoomId);
    clearCallResumeSnapshot();
    resumeAttemptAtRef.current = null;
    resumeAttemptKeyRef.current = null;
    lastPersistedResumeSignatureRef.current = null;
    restoreInProgressRef.current = false;
    setPendingJoin(null);
    await call.leave();
  }, [activeRoomId, boundRoomId, call]);

  const [isReleasingForTransfer, setIsReleasingForTransfer] =
    React.useState(false);

  const showFloatingDock =
    isMatrixSyncLeader && (inSession || call.recordingStatus === 'uploading');
  const holdsMatrixSyncForCall =
    (isMatrixSyncLeader || isReleasingForTransfer) &&
    (inSession ||
      call.recordingStatus === 'uploading' ||
      pendingJoin != null ||
      restoreInProgressRef.current ||
      call.isCallRecovering);

  React.useEffect(() => {
    setGroupCallSessionActive(holdsMatrixSyncForCall);
  }, [holdsMatrixSyncForCall]);

  React.useEffect(() => {
    return () => {
      setGroupCallSessionActive(false);
    };
  }, []);

  const spaceCallRetryRemoteMedia = call.retryRemoteMediaConnection;
  const retryRemoteMediaConnection = React.useCallback(() => {
    spaceCallRetryRemoteMedia();
    void resumeCallPlayback();
  }, [spaceCallRetryRemoteMedia]);

  return {
    bindRoomContext,
    boundRoomId,
    boundSpaceSlug,
    activeRoomId,
    activeSpaceSlug,
    pinnedCallSpaceSlug,
    dockMode,
    setDockMode,
    showFloatingDock,
    startAudioForRoom,
    startVideoForRoom,
    ...call,
    retryRemoteMediaConnection,
    ...callReactions,
    leave: leaveCall,
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
