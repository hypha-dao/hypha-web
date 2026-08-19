'use client';

import React from 'react';
import {
  getRemoteGroupCallHoldRoomId,
  isRemoteGroupCallHoldActive,
  requestRemoteGroupCallLeave,
  setGroupCallSessionActive,
  subscribeGroupCallPleaseLeave,
  useMatrix,
  useSpaceGroupCall,
} from '@hypha-platform/core/client';
import { revalidateSpaceMemoryOrg } from '../coherence/hooks/use-space-memory-org';
import { useCallReactions } from './human-chat-panel/use-call-reactions';
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
  /** #2456 D2c/D2e: 'refresh' evicts a stale participant first (see `call.rejoinCall`) instead of
   * a plain join. Defaults to 'join' behavior wherever unset (existing callers). */
  mode?: 'join' | 'refresh';
};

/**
 * #2456 D2 scenario 0 (same tab, different room): captured when `startAudioForRoom`/
 * `startVideoForRoom` is blocked by an in-progress call in a different room, instead of the old
 * silent no-op. Drives a confirm dialog ("Leave it and join this one?") in
 * `GlobalCallDockOverlay`; `confirmRoomSwitch()`/`cancelRoomSwitch()` act on it.
 */
export type PendingRoomSwitchConfirm = {
  kind: 'audio' | 'video';
  mode?: 'join' | 'refresh';
  fromRoomId: string;
  targetRoomId: string;
  targetSpaceSlug: string | null;
  targetAuthToken: string | null;
  threadRootEventId?: string;
  launchContext: CallLaunchContext | null;
  /** #2456 D2d: the blocking call is in *another tab* of this browser, not this one — on
   * confirm, broadcast a `please-leave` request instead of calling this tab's own `leave()`,
   * and join immediately (this tab was never in a session, so there's no local teardown to
   * wait for). */
  crossTab?: boolean;
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
  const { client } = useMatrix();
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
  const [pendingRoomSwitchConfirm, setPendingRoomSwitchConfirm] =
    React.useState<PendingRoomSwitchConfirm | null>(null);
  const [dockMode, setDockMode] =
    React.useState<GlobalCallDockMode>('thumbnail');
  const [dockModeHydrated, setDockModeHydrated] = React.useState(false);
  const restoreInProgressRef = React.useRef(false);
  const restoreTimerRef = React.useRef<number | null>(null);
  const resumeAttemptAtRef = React.useRef<number | null>(null);
  const resumeAttemptKeyRef = React.useRef<string | null>(null);
  const lastPersistedResumeSignatureRef = React.useRef<string | null>(null);
  /** Blocks resume/pending-join after an explicit hang-up (same tab, same render). */
  const userDismissedCallRef = React.useRef(false);
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
    callSessionId: call.callSessionId ?? null,
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
    if (inSession || pendingJoin) return;
    if (userDismissedCallRef.current) return;
    const snapshot = readCallResumeSnapshot();
    if (!snapshot) return;
    /** Avoid every tab of this browser auto-resuming the same call simultaneously — skip if
     * another tab already holds (or is about to hold) this room's call. */
    if (getRemoteGroupCallHoldRoomId() === snapshot.roomId) return;
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
  }, [inSession, pendingJoin]);

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
  const rejoinCall = call.rejoinCall;

  React.useEffect(() => {
    if (!pendingJoin) return;
    if (userDismissedCallRef.current) {
      setPendingJoin(null);
      return;
    }
    if (!client) return;
    if (activeRoomId !== pendingJoin.roomId) return;
    if (!activeAuthToken) return;

    const join = pendingJoin;
    setPendingJoin(null);
    restoreInProgressRef.current = false;
    if (join.mode === 'refresh') {
      void rejoinCall(join.kind, join.threadRootEventId);
      return;
    }
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
    rejoinCall,
    enterAudio,
    enterVideo,
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
      /** Only clear the (shared, cross-tab) resume snapshot when no tab of this browser holds
       * a call — this tab being idle says nothing about another tab's active session. */
      if (
        !isRemoteGroupCallHoldActive() &&
        call.callState === 'idle' &&
        !pendingJoin
      ) {
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
      const targetSpaceSlug = spaceSlug?.trim() ?? null;
      const targetAuthToken = authToken?.trim() || boundAuthToken;
      const pinnedCallRoomId =
        callSessionRoomIdRef.current ??
        (inSessionRef.current ? activeRoomId : null);
      if (pinnedCallRoomId && pinnedCallRoomId !== targetRoomId) {
        setPendingRoomSwitchConfirm({
          kind: 'audio',
          fromRoomId: pinnedCallRoomId,
          targetRoomId,
          targetSpaceSlug,
          targetAuthToken,
          threadRootEventId,
          launchContext: launchContext ?? null,
        });
        return;
      }
      /** #2456 D2d: no local session pinning us, but another tab of this browser holds one
       * in a different room. */
      const remoteHoldRoomId = getRemoteGroupCallHoldRoomId();
      if (remoteHoldRoomId && remoteHoldRoomId !== targetRoomId) {
        setPendingRoomSwitchConfirm({
          kind: 'audio',
          fromRoomId: remoteHoldRoomId,
          targetRoomId,
          targetSpaceSlug,
          targetAuthToken,
          threadRootEventId,
          launchContext: launchContext ?? null,
          crossTab: true,
        });
        return;
      }
      userDismissedCallRef.current = false;
      clearCallDismissedByUser();
      callLaunchContextRef.current =
        launchContext?.signalTitle?.trim() || launchContext?.roomTitle?.trim()
          ? launchContext
          : threadRootEventId?.trim()
          ? { threadRootEventId: threadRootEventId.trim() }
          : null;
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
      const targetSpaceSlug = spaceSlug?.trim() ?? null;
      const targetAuthToken = authToken?.trim() || boundAuthToken;
      const pinnedCallRoomId =
        callSessionRoomIdRef.current ??
        (inSessionRef.current ? activeRoomId : null);
      if (pinnedCallRoomId && pinnedCallRoomId !== targetRoomId) {
        setPendingRoomSwitchConfirm({
          kind: 'video',
          fromRoomId: pinnedCallRoomId,
          targetRoomId,
          targetSpaceSlug,
          targetAuthToken,
          threadRootEventId,
          launchContext: launchContext ?? null,
        });
        return;
      }
      const remoteHoldRoomId = getRemoteGroupCallHoldRoomId();
      if (remoteHoldRoomId && remoteHoldRoomId !== targetRoomId) {
        setPendingRoomSwitchConfirm({
          kind: 'video',
          fromRoomId: remoteHoldRoomId,
          targetRoomId,
          targetSpaceSlug,
          targetAuthToken,
          threadRootEventId,
          launchContext: launchContext ?? null,
          crossTab: true,
        });
        return;
      }
      userDismissedCallRef.current = false;
      clearCallDismissedByUser();
      callLaunchContextRef.current =
        launchContext?.signalTitle?.trim() || launchContext?.roomTitle?.trim()
          ? launchContext
          : threadRootEventId?.trim()
          ? { threadRootEventId: threadRootEventId.trim() }
          : null;
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

  /**
   * #2456 D2c/D2e "Refresh call": same pinned-room guard and rebind/pendingJoin sequencing as
   * `startAudioForRoom`/`startVideoForRoom` above, but tagged `mode: 'refresh'` so the eventual
   * join goes through `call.rejoinCall` (evicts the stale participant first) instead of a plain
   * `enterAudio`/`enterVideo`.
   */
  const refreshRoomCall = React.useCallback(
    async (
      kind: 'audio' | 'video',
      roomId: string | null | undefined,
      spaceSlug?: string | null,
      threadRootEventId?: string,
      authToken?: string | null,
      launchContext?: CallLaunchContext | null,
    ) => {
      const targetRoomId = roomId?.trim();
      if (!targetRoomId) return;
      const targetSpaceSlug = spaceSlug?.trim() ?? null;
      const targetAuthToken = authToken?.trim() || boundAuthToken;
      const pinnedCallRoomId =
        callSessionRoomIdRef.current ??
        (inSessionRef.current ? activeRoomId : null);
      if (pinnedCallRoomId && pinnedCallRoomId !== targetRoomId) {
        setPendingRoomSwitchConfirm({
          kind,
          mode: 'refresh',
          fromRoomId: pinnedCallRoomId,
          targetRoomId,
          targetSpaceSlug,
          targetAuthToken,
          threadRootEventId,
          launchContext: launchContext ?? null,
        });
        return;
      }
      const remoteHoldRoomId = getRemoteGroupCallHoldRoomId();
      if (remoteHoldRoomId && remoteHoldRoomId !== targetRoomId) {
        setPendingRoomSwitchConfirm({
          kind,
          mode: 'refresh',
          fromRoomId: remoteHoldRoomId,
          targetRoomId,
          targetSpaceSlug,
          targetAuthToken,
          threadRootEventId,
          launchContext: launchContext ?? null,
          crossTab: true,
        });
        return;
      }
      userDismissedCallRef.current = false;
      clearCallDismissedByUser();
      callLaunchContextRef.current =
        launchContext?.signalTitle?.trim() || launchContext?.roomTitle?.trim()
          ? launchContext
          : threadRootEventId?.trim()
          ? { threadRootEventId: threadRootEventId.trim() }
          : null;
      if (activeRoomId !== targetRoomId) {
        setBoundRoomId(targetRoomId);
        setBoundSpaceSlug(targetSpaceSlug);
        setBoundAuthToken(targetAuthToken);
        setActiveRoomId(targetRoomId);
        setActiveSpaceSlug(targetSpaceSlug);
        setActiveAuthToken(targetAuthToken);
        setPendingJoin({
          kind,
          mode: 'refresh',
          roomId: targetRoomId,
          threadRootEventId,
        });
        return;
      }
      await call.rejoinCall(kind, threadRootEventId);
    },
    [activeRoomId, boundAuthToken, call],
  );

  /**
   * #2456 D2c/D2e entry point for the "Refresh call" button: same browser (another tab already
   * holds this room's call, per `isRemoteGroupCallHoldActive()`) acts immediately; a different
   * device shows a confirm dialog first ("Move this call here?").
   */
  const [pendingRefreshDeviceConfirm, setPendingRefreshDeviceConfirm] =
    React.useState<{
      kind: 'audio' | 'video';
      roomId: string;
      spaceSlug: string | null;
      threadRootEventId?: string;
      authToken: string | null;
      launchContext: CallLaunchContext | null;
    } | null>(null);

  const refreshCall = React.useCallback(
    (
      kind: 'audio' | 'video',
      roomId: string | null | undefined,
      spaceSlug?: string | null,
      threadRootEventId?: string,
      authToken?: string | null,
      launchContext?: CallLaunchContext | null,
    ) => {
      const targetRoomId = roomId?.trim();
      if (!targetRoomId) return;
      if (isRemoteGroupCallHoldActive()) {
        void refreshRoomCall(
          kind,
          targetRoomId,
          spaceSlug,
          threadRootEventId,
          authToken,
          launchContext,
        );
        return;
      }
      setPendingRefreshDeviceConfirm({
        kind,
        roomId: targetRoomId,
        spaceSlug: spaceSlug?.trim() ?? null,
        threadRootEventId,
        authToken: authToken?.trim() || boundAuthToken,
        launchContext: launchContext ?? null,
      });
    },
    [refreshRoomCall, boundAuthToken],
  );

  const confirmRefreshDevice = React.useCallback(() => {
    const pending = pendingRefreshDeviceConfirm;
    if (!pending) return;
    setPendingRefreshDeviceConfirm(null);
    void refreshRoomCall(
      pending.kind,
      pending.roomId,
      pending.spaceSlug,
      pending.threadRootEventId,
      pending.authToken,
      pending.launchContext,
    );
  }, [pendingRefreshDeviceConfirm, refreshRoomCall]);

  const cancelRefreshDevice = React.useCallback(() => {
    setPendingRefreshDeviceConfirm(null);
  }, []);

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

  /**
   * #2456 D2 scenario 0's "Leave & Join" confirm action. `activeRoomId` only clears via the
   * effect below reacting to `callState === 'idle'`, not synchronously when `leave()`'s promise
   * resolves — awaiting it and immediately joining would race that (same reasoning as
   * `space-call-join-hero-banner.tsx`'s `pendingCallSwitch`, which predates this and follows the
   * identical pattern).
   */
  const [pendingRoomSwitchJoin, setPendingRoomSwitchJoin] =
    React.useState<PendingRoomSwitchConfirm | null>(null);

  const confirmRoomSwitch = React.useCallback(async () => {
    const pending = pendingRoomSwitchConfirm;
    if (!pending) return;
    setPendingRoomSwitchConfirm(null);
    setPendingRoomSwitchJoin(pending);
    /** #2456 D2d: the blocking call is in another tab — ask it to leave instead of leaving our
     * own (nonexistent) session. This tab was never in a call, so there's nothing to await:
     * the effect below fires as soon as `activeRoomId` already matches the target (which it
     * typically does immediately, since the room the "Join call" button belongs to is usually
     * already bound). */
    if (pending.crossTab) {
      requestRemoteGroupCallLeave();
      return;
    }
    try {
      await leaveCall();
    } catch {
      setPendingRoomSwitchJoin((prev) => (prev === pending ? null : prev));
    }
  }, [pendingRoomSwitchConfirm, leaveCall]);

  const cancelRoomSwitch = React.useCallback(() => {
    setPendingRoomSwitchConfirm(null);
  }, []);

  React.useEffect(() => {
    if (!pendingRoomSwitchJoin) return;
    if (
      activeRoomId?.trim() &&
      activeRoomId.trim() !== pendingRoomSwitchJoin.targetRoomId
    ) {
      return;
    }
    const pending = pendingRoomSwitchJoin;
    setPendingRoomSwitchJoin(null);
    if (pending.mode === 'refresh') {
      void refreshRoomCall(
        pending.kind,
        pending.targetRoomId,
        pending.targetSpaceSlug,
        pending.threadRootEventId,
        pending.targetAuthToken,
        pending.launchContext,
      );
    } else if (pending.kind === 'audio') {
      void startAudioForRoom(
        pending.targetRoomId,
        pending.targetSpaceSlug,
        pending.threadRootEventId,
        pending.targetAuthToken,
        pending.launchContext,
      );
    } else {
      void startVideoForRoom(
        pending.targetRoomId,
        pending.targetSpaceSlug,
        pending.threadRootEventId,
        pending.targetAuthToken,
        pending.launchContext,
      );
    }
  }, [
    pendingRoomSwitchJoin,
    activeRoomId,
    startAudioForRoom,
    startVideoForRoom,
    refreshRoomCall,
  ]);

  const showFloatingDock = inSession || call.recordingStatus === 'uploading';
  const holdsMatrixSyncForCall =
    inSession ||
    call.recordingStatus === 'uploading' ||
    pendingJoin != null ||
    restoreInProgressRef.current ||
    call.isCallRecovering;

  React.useEffect(() => {
    setGroupCallSessionActive(
      holdsMatrixSyncForCall,
      holdsMatrixSyncForCall
        ? callSessionRoomIdRef.current ?? activeRoomId
        : null,
    );
  }, [holdsMatrixSyncForCall, activeRoomId]);

  React.useEffect(() => {
    return () => {
      setGroupCallSessionActive(false);
    };
  }, []);

  /** #2456 D2d: another tab of this browser asked us to leave (cross-tab room switch). */
  React.useEffect(() => {
    return subscribeGroupCallPleaseLeave(() => {
      void leaveCall();
    });
  }, [leaveCall]);

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
    pendingRoomSwitchConfirm,
    confirmRoomSwitch,
    cancelRoomSwitch,
    refreshCall,
    pendingRefreshDeviceConfirm,
    confirmRefreshDevice,
    cancelRefreshDevice,
    ...call,
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
