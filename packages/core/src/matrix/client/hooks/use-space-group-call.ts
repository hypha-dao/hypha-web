'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as MatrixSdk from 'matrix-js-sdk';
import { useMatrix } from '../providers/matrix-provider';
import { isPermissionLikeGroupCallError } from './space-group-call-utils';
import { logSpaceGroupCallEvent } from './space-group-call-telemetry';

/** matrix-js-sdk client emits this when a room GroupCall is terminated. */
const GROUP_CALL_ENDED_EVENT = 'GroupCall.ended' as const;

export type SpaceGroupCallState =
  | 'idle'
  | 'initializing'
  | 'awaiting_media'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export type SpaceGroupCallErrorCode =
  | 'NO_CLIENT'
  | 'NO_ROOM'
  | 'NOT_READY'
  | 'PERMISSION_DENIED'
  | 'WEBRTC_FAILED'
  | 'UNKNOWN';

const { GroupCallEvent, GroupCallIntent, GroupCallType, GroupCallState } =
  MatrixSdk;

/** `callSessionId` for correlation; must not use `Math.random()` (CodeQL / GAS-weak-randomness). */
function newCallSessionId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint8Array(16);
    c.getRandomValues(buf);
    buf[6] = (buf[6]! & 0x0f) | 0x40;
    buf[8] = (buf[8]! & 0x3f) | 0x80;
    const hex = [...buf].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
      12,
      16,
    )}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
  throw new Error(
    'crypto.getRandomValues is not available (required for call session id)',
  );
}

export function useSpaceGroupCall(roomId: string | null) {
  const { client } = useMatrix();

  const [callState, setCallState] = useState<SpaceGroupCallState>('idle');
  const [errorCode, setErrorCode] = useState<SpaceGroupCallErrorCode | null>(
    null,
  );
  const [threadContext, setThreadContext] = useState<{
    threadRootEventId: string;
  } | null>(null);
  const [callKind, setCallKind] = useState<'audio' | 'video' | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [isScreensharing, setIsScreensharing] = useState(false);
  const [localPreviewStream, setLocalPreviewStream] =
    useState<MediaStream | null>(null);
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false);
  const [isLocalVideoMuted, setIsLocalVideoMuted] = useState(true);
  /** Active GroupCall for UI (tiles); cleared on leave. */
  const [groupCall, setGroupCall] = useState<MatrixSdk.GroupCall | null>(null);
  /** Bumps when userMediaFeeds / screenshareFeeds change (re-render stage). */
  const [feedVersion, setFeedVersion] = useState(0);
  /** `userId::deviceId` for GroupCall.activeSpeaker; Phase 4 optional UI highlight. */
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [activeSpeakerKey, setActiveSpeakerKey] = useState<string | null>(null);
  /** Screenshare-only failure (does not end the call). */
  const [screenshareErrorCode, setScreenshareErrorCode] =
    useState<SpaceGroupCallErrorCode | null>(null);

  const groupCallRef = useRef<MatrixSdk.GroupCall | null>(null);
  const isJoiningRef = useRef(false);
  /** Batches rapid feed list events into one React update per frame (Phase 5.2). */
  const feedUpdateRafRef = useRef<number | null>(null);
  const lastJoinKindRef = useRef<'audio' | 'video' | null>(null);
  const lastThreadRootEventIdRef = useRef<string | undefined>(undefined);
  const joinStartedAtRef = useRef<number | null>(null);
  const lastRoomIdForTelemetryRef = useRef<string | null>(null);
  const activeGroupCallRoomIdRef = useRef<string | null>(null);
  const loggedStatsForGroupCallIdRef = useRef<string | null>(null);
  const [tabBackgroundWhileInCall, setTabBackgroundWhileInCall] =
    useState(false);
  /**
   * When local user is not in a call, counts participants from the room’s
   * `GroupCall` (Matrix member state) so the UI can show “call in progress”
   * and a Join affordance. When in our session, use `participantCount` instead.
   */
  const [idleRoomParticipantCount, setIdleRoomParticipantCount] = useState(0);
  const [idleInCallUserIds, setIdleInCallUserIds] = useState<string[]>([]);

  const setActiveKeyFromGroupCall = useCallback((gc: MatrixSdk.GroupCall) => {
    const f = gc.activeSpeaker;
    setActiveSpeakerKey(f ? `${f.userId}::${f.deviceId ?? ''}` : null);
  }, []);

  const scheduleFeedBatched = useCallback(() => {
    if (typeof window === 'undefined') {
      setFeedVersion((v) => v + 1);
      return;
    }
    if (feedUpdateRafRef.current != null) return;
    feedUpdateRafRef.current = window.requestAnimationFrame(() => {
      feedUpdateRafRef.current = null;
      setFeedVersion((v) => v + 1);
    });
  }, []);

  const runCleanup = useCallback(() => {
    if (feedUpdateRafRef.current != null) {
      cancelAnimationFrame(feedUpdateRafRef.current);
      feedUpdateRafRef.current = null;
    }
    const gc = groupCallRef.current;
    if (gc) {
      try {
        gc.removeAllListeners(GroupCallEvent.Error);
        gc.removeAllListeners(GroupCallEvent.GroupCallStateChanged);
        gc.removeAllListeners(GroupCallEvent.LocalScreenshareStateChanged);
        gc.removeAllListeners(GroupCallEvent.ParticipantsChanged);
        gc.removeAllListeners(GroupCallEvent.UserMediaFeedsChanged);
        gc.removeAllListeners(GroupCallEvent.ScreenshareFeedsChanged);
        gc.removeAllListeners(GroupCallEvent.LocalMuteStateChanged);
        gc.removeAllListeners(GroupCallEvent.ActiveSpeakerChanged);
      } catch {
        // ignore
      }
      const leave = gc.leave.bind(gc) as () => void;
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(leave);
      } else {
        setTimeout(leave, 0);
      }
      groupCallRef.current = null;
    }
    activeGroupCallRoomIdRef.current = null;
    isJoiningRef.current = false;
    setLocalPreviewStream(null);
    setIsMicrophoneMuted(false);
    setIsLocalVideoMuted(true);
    setGroupCall(null);
    setActiveSpeakerKey(null);
    setCallSessionId(null);
    setScreenshareErrorCode(null);
    loggedStatsForGroupCallIdRef.current = null;
    lastRoomIdForTelemetryRef.current = null;
  }, []);

  const refreshLocalPreview = useCallback(() => {
    const gc = groupCallRef.current;
    if (!gc) {
      setLocalPreviewStream(null);
      return;
    }
    const feed = gc.localCallFeed;
    setLocalPreviewStream(feed?.stream ?? null);
  }, []);

  const updateParticipantCount = useCallback(() => {
    const gc = groupCallRef.current;
    if (!gc) {
      setParticipantCount(0);
      return;
    }
    let n = 0;
    for (const [, deviceMap] of gc.participants) {
      n += deviceMap.size;
    }
    setParticipantCount(n);
  }, []);

  const readParticipantsFromGroupCall = useCallback(
    (gc: MatrixSdk.GroupCall) => {
      const userIdSet = new Set<string>();
      let deviceCount = 0;
      for (const [member, deviceMap] of gc.participants) {
        for (const _x of deviceMap.values()) {
          deviceCount += 1;
          if (member.userId) userIdSet.add(member.userId);
        }
      }
      return { count: deviceCount, inCallUserIds: [...userIdSet] };
    },
    [],
  );

  const inCallUserIdsFromGroupCall = useCallback(
    (gc: MatrixSdk.GroupCall | null) => {
      if (!gc) return [];
      return readParticipantsFromGroupCall(gc).inCallUserIds;
    },
    [readParticipantsFromGroupCall],
  );

  const attachGroupCallListeners = useCallback(
    (gc: MatrixSdk.GroupCall) => {
      const onError = (err: unknown) => {
        const isPerm = isPermissionLikeGroupCallError(err);
        const code: SpaceGroupCallErrorCode = isPerm
          ? 'PERMISSION_DENIED'
          : 'WEBRTC_FAILED';
        if (isPerm) {
          setErrorCode('PERMISSION_DENIED');
        } else {
          setErrorCode('WEBRTC_FAILED');
        }
        if (roomId) {
          logSpaceGroupCallEvent({
            name: 'hypha.group_call.error',
            roomId,
            kind: lastJoinKindRef.current ?? undefined,
            errorCode: code,
          });
        }
        setCallState('error');
        runCleanup();
        setCallKind(null);
        setIsScreensharing(false);
        setThreadContext(null);
      };
      gc.on(GroupCallEvent.Error, onError);
      const onState = (newState: MatrixSdk.GroupCallState) => {
        if (newState === GroupCallState.Entered) {
          setCallState('connected');
          refreshLocalPreview();
          updateParticipantCount();
        }
      };
      gc.on(GroupCallEvent.GroupCallStateChanged, onState);
      gc.on(GroupCallEvent.LocalScreenshareStateChanged, (sharing: boolean) => {
        setIsScreensharing(sharing);
      });
      gc.on(GroupCallEvent.ParticipantsChanged, () => {
        updateParticipantCount();
      });
      const onFeedsMaybeParticipants = () => {
        scheduleFeedBatched();
        updateParticipantCount();
      };
      gc.on(GroupCallEvent.UserMediaFeedsChanged, onFeedsMaybeParticipants);
      gc.on(GroupCallEvent.ScreenshareFeedsChanged, onFeedsMaybeParticipants);
      const onActiveSpeaker = (
        feed: { userId: string; deviceId?: string } | undefined,
      ) => {
        setActiveSpeakerKey(
          feed ? `${feed.userId}::${feed.deviceId ?? ''}` : null,
        );
      };
      gc.on(GroupCallEvent.ActiveSpeakerChanged, onActiveSpeaker);
      onActiveSpeaker(gc.activeSpeaker);
      gc.on(
        GroupCallEvent.LocalMuteStateChanged,
        (audioMuted: boolean, videoMuted: boolean) => {
          setIsMicrophoneMuted(audioMuted);
          setIsLocalVideoMuted(videoMuted);
        },
      );
    },
    [
      roomId,
      refreshLocalPreview,
      runCleanup,
      scheduleFeedBatched,
      updateParticipantCount,
    ],
  );

  const enterWithKind = useCallback(
    async (kind: 'audio' | 'video', threadRootEventId?: string) => {
      if (!client || !roomId?.trim()) {
        setErrorCode(!client ? 'NO_CLIENT' : 'NO_ROOM');
        setCallState('error');
        return;
      }
      if (isJoiningRef.current) return;
      if (groupCallRef.current) return;

      setIdleRoomParticipantCount(0);
      setIdleInCallUserIds([]);

      isJoiningRef.current = true;
      const newSessionId = newCallSessionId();
      setCallSessionId(newSessionId);
      lastJoinKindRef.current = kind;
      lastThreadRootEventIdRef.current = threadRootEventId;
      lastRoomIdForTelemetryRef.current = roomId;
      const joinT0 =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
      joinStartedAtRef.current = joinT0;
      setErrorCode(null);
      setScreenshareErrorCode(null);
      if (threadRootEventId) {
        setThreadContext({ threadRootEventId });
      }
      setCallKind(kind);
      setCallState('initializing');

      try {
        await client.waitUntilRoomReadyForGroupCalls(roomId);
      } catch {
        setErrorCode('NOT_READY');
        setCallState('error');
        setCallKind(null);
        setThreadContext(null);
        setCallSessionId(null);
        isJoiningRef.current = false;
        joinStartedAtRef.current = null;
        if (roomId) {
          logSpaceGroupCallEvent({
            name: 'hypha.group_call.error',
            roomId,
            kind,
            errorCode: 'NOT_READY',
          });
        }
        return;
      }

      const type = kind === 'video' ? GroupCallType.Video : GroupCallType.Voice;
      let gc = client.getGroupCallForRoom(roomId);

      if (!gc) {
        setCallState('connecting');
        try {
          gc = await client.createGroupCall(
            roomId,
            type,
            false,
            GroupCallIntent.Room,
          );
        } catch (e) {
          if (
            e instanceof Error &&
            e.message.includes('already has an existing group call')
          ) {
            gc = client.getGroupCallForRoom(roomId);
          } else {
            isJoiningRef.current = false;
            setErrorCode('UNKNOWN');
            setCallSessionId(null);
            if (roomId) {
              logSpaceGroupCallEvent({
                name: 'hypha.group_call.error',
                roomId,
                kind,
                errorCode: 'UNKNOWN',
              });
            }
            setCallState('error');
            setCallKind(null);
            setThreadContext(null);
            joinStartedAtRef.current = null;
            return;
          }
        }
      }

      if (!gc) {
        setErrorCode('UNKNOWN');
        setCallSessionId(null);
        if (roomId) {
          logSpaceGroupCallEvent({
            name: 'hypha.group_call.error',
            roomId,
            kind,
            errorCode: 'UNKNOWN',
          });
        }
        setCallState('error');
        setCallKind(null);
        setThreadContext(null);
        isJoiningRef.current = false;
        joinStartedAtRef.current = null;
        return;
      }

      type GroupCallPreEnterMute = {
        initWithVideoMuted: boolean;
        initWithAudioMuted: boolean;
      };
      const gci = gc as unknown as GroupCallPreEnterMute;
      gci.initWithVideoMuted = kind === 'audio';
      gci.initWithAudioMuted = false;

      groupCallRef.current = gc;
      activeGroupCallRoomIdRef.current = roomId;
      setGroupCall(gc);
      attachGroupCallListeners(gc);
      updateParticipantCount();
      setCallState('connecting');

      try {
        await gc.enter();
      } catch (e) {
        isJoiningRef.current = false;
        if (isPermissionLikeGroupCallError(e)) {
          setErrorCode('PERMISSION_DENIED');
        } else {
          setErrorCode('WEBRTC_FAILED');
        }
        if (roomId) {
          logSpaceGroupCallEvent({
            name: 'hypha.group_call.error',
            roomId,
            kind,
            errorCode: isPermissionLikeGroupCallError(e)
              ? 'PERMISSION_DENIED'
              : 'WEBRTC_FAILED',
          });
        }
        setCallState('error');
        runCleanup();
        setCallKind(null);
        setThreadContext(null);
        joinStartedAtRef.current = null;
        return;
      }

      setCallState('connected');
      refreshLocalPreview();
      updateParticipantCount();
      setIsMicrophoneMuted(gc.isMicrophoneMuted());
      setIsLocalVideoMuted(gc.isLocalVideoMuted());
      setActiveKeyFromGroupCall(gc);
      isJoiningRef.current = false;
      lastRoomIdForTelemetryRef.current = roomId;
      const t1 =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (joinStartedAtRef.current != null) {
        const joinMs = Math.round(t1 - joinStartedAtRef.current);
        logSpaceGroupCallEvent({
          name: 'hypha.group_call.join_ms',
          roomId,
          kind,
          joinMs,
        });
        joinStartedAtRef.current = null;
      }
      if (
        process.env.NODE_ENV === 'development' &&
        loggedStatsForGroupCallIdRef.current !== gc.groupCallId
      ) {
        loggedStatsForGroupCallIdRef.current = gc.groupCallId;
        try {
          const stats = gc.getGroupCallStats();

          console.debug(
            '[hypha.group_call] getGroupCallStats (dev only)',
            gc.groupCallId,
            stats,
          );
        } catch {
          // ignore
        }
      }
    },
    [
      attachGroupCallListeners,
      client,
      roomId,
      refreshLocalPreview,
      runCleanup,
      setActiveKeyFromGroupCall,
      updateParticipantCount,
    ],
  );

  const enterAudio = useCallback(
    async (threadRootEventId?: string) => {
      await enterWithKind('audio', threadRootEventId);
    },
    [enterWithKind],
  );

  const enterVideo = useCallback(
    async (threadRootEventId?: string) => {
      await enterWithKind('video', threadRootEventId);
    },
    [enterWithKind],
  );

  const leave = useCallback(async () => {
    if (callState === 'idle' || callState === 'disconnecting') return;
    setCallState('disconnecting');
    if (lastRoomIdForTelemetryRef.current) {
      logSpaceGroupCallEvent({
        name: 'hypha.group_call.left',
        roomId: lastRoomIdForTelemetryRef.current,
        kind: lastJoinKindRef.current ?? undefined,
        reason: 'user',
      });
    }
    runCleanup();
    setCallState('idle');
    setErrorCode(null);
    setCallKind(null);
    setIsScreensharing(false);
    setThreadContext(null);
    setParticipantCount(0);
    setTabBackgroundWhileInCall(false);
  }, [callState, runCleanup]);

  const setMicrophoneMuted = useCallback(
    async (muted: boolean) => {
      const gc = groupCallRef.current;
      if (!gc) return;
      await gc.setMicrophoneMuted(muted);
      setIsMicrophoneMuted(gc.isMicrophoneMuted());
      scheduleFeedBatched();
    },
    [scheduleFeedBatched],
  );

  const setCameraMuted = useCallback(
    async (muted: boolean) => {
      const gc = groupCallRef.current;
      if (!gc) return;
      await gc.setLocalVideoMuted(muted);
      setIsLocalVideoMuted(gc.isLocalVideoMuted());
      scheduleFeedBatched();
    },
    [scheduleFeedBatched],
  );

  const setScreensharingEnabled = useCallback(
    async (enabled: boolean) => {
      const gc = groupCallRef.current;
      if (!gc) return;
      setScreenshareErrorCode(null);
      try {
        const ok = await gc.setScreensharingEnabled(enabled);
        if (ok === false) {
          setScreenshareErrorCode('WEBRTC_FAILED');
        }
      } catch (e) {
        if (isPermissionLikeGroupCallError(e)) {
          setScreenshareErrorCode('PERMISSION_DENIED');
        } else {
          setScreenshareErrorCode('WEBRTC_FAILED');
        }
      }
      scheduleFeedBatched();
    },
    [scheduleFeedBatched],
  );

  useEffect(() => {
    if (!groupCallRef.current) return;
    if (activeGroupCallRoomIdRef.current === roomId) return;
    if (lastRoomIdForTelemetryRef.current) {
      logSpaceGroupCallEvent({
        name: 'hypha.group_call.left',
        roomId: lastRoomIdForTelemetryRef.current,
        kind: lastJoinKindRef.current ?? undefined,
        reason: 'room',
      });
    }
    setCallState('disconnecting');
    runCleanup();
    setCallState('idle');
    setErrorCode(null);
    setCallKind(null);
    setIsScreensharing(false);
    setThreadContext(null);
    setParticipantCount(0);
    setScreenshareErrorCode(null);
    setTabBackgroundWhileInCall(false);
  }, [roomId, runCleanup]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = () => {
      const inCall =
        callState === 'connecting' ||
        callState === 'connected' ||
        callState === 'awaiting_media' ||
        callState === 'initializing';
      setTabBackgroundWhileInCall(
        inCall && typeof document !== 'undefined' && document.hidden,
      );
    };
    document.addEventListener('visibilitychange', onVis);
    onVis();
    return () => {
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [callState]);

  useEffect(() => {
    return () => {
      if (groupCallRef.current && lastRoomIdForTelemetryRef.current) {
        logSpaceGroupCallEvent({
          name: 'hypha.group_call.left',
          roomId: lastRoomIdForTelemetryRef.current,
          kind: lastJoinKindRef.current ?? undefined,
          reason: 'unmount',
        });
      }
      runCleanup();
    };
  }, [runCleanup]);

  const idleGroupCallUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    idleGroupCallUnsubRef.current?.();
    idleGroupCallUnsubRef.current = null;
    setIdleRoomParticipantCount(0);
    setIdleInCallUserIds([]);

    if (!client || !roomId?.trim()) return;
    if (groupCallRef.current) return;
    if (callState !== 'idle' && callState !== 'error') return;

    const gc = client.getGroupCallForRoom(roomId);
    if (!gc) return;

    const sync = () => {
      if (groupCallRef.current) {
        return;
      }
      const current = client.getGroupCallForRoom(roomId);
      if (!current) {
        setIdleRoomParticipantCount(0);
        setIdleInCallUserIds([]);
        return;
      }
      const p = readParticipantsFromGroupCall(current);
      if (p.count === 0) {
        setIdleRoomParticipantCount(0);
        setIdleInCallUserIds([]);
        return;
      }
      setIdleRoomParticipantCount(p.count);
      setIdleInCallUserIds(p.inCallUserIds);
    };

    sync();
    gc.on(GroupCallEvent.ParticipantsChanged, sync);
    const onEnded = (ended: MatrixSdk.GroupCall) => {
      if (ended.room?.roomId !== roomId) return;
      sync();
    };
    const c = client as MatrixSdk.MatrixClient & {
      on(ev: string, fn: (ended: MatrixSdk.GroupCall) => void): void;
      removeListener(
        ev: string,
        fn: (ended: MatrixSdk.GroupCall) => void,
      ): void;
    };
    c.on(GROUP_CALL_ENDED_EVENT, onEnded);
    const unsub = () => {
      gc.removeListener(GroupCallEvent.ParticipantsChanged, sync);
      c.removeListener(GROUP_CALL_ENDED_EVENT, onEnded);
    };
    idleGroupCallUnsubRef.current = unsub;
    return () => {
      unsub();
    };
  }, [client, roomId, callState, readParticipantsFromGroupCall]);

  const dismissScreenshareError = useCallback(() => {
    setScreenshareErrorCode(null);
  }, []);

  const dismissCallError = useCallback(() => {
    if (callState !== 'error') return;
    setErrorCode(null);
    setCallState('idle');
    setCallKind(null);
    setThreadContext(null);
    isJoiningRef.current = false;
  }, [callState]);

  const retryFromError = useCallback(() => {
    if (callState !== 'error') return;
    const k = lastJoinKindRef.current;
    if (!k) {
      setErrorCode(null);
      setCallState('idle');
      return;
    }
    setErrorCode(null);
    setCallState('idle');
    void enterWithKind(k, lastThreadRootEventIdRef.current);
  }, [callState, enterWithKind]);

  const inOurSession =
    callState === 'connecting' ||
    callState === 'connected' ||
    callState === 'awaiting_media' ||
    callState === 'initializing' ||
    callState === 'disconnecting';

  const roomGroupCallDeviceCount = inOurSession
    ? participantCount
    : idleRoomParticipantCount;

  const othersInRoomCallCount = useMemo(() => {
    if (roomGroupCallDeviceCount === 0) return 0;
    if (inOurSession) {
      return Math.max(0, participantCount - 1);
    }
    return roomGroupCallDeviceCount;
  }, [inOurSession, participantCount, roomGroupCallDeviceCount]);

  const inCallUserIdsForRoster = inOurSession
    ? inCallUserIdsFromGroupCall(groupCall)
    : idleInCallUserIds;

  const showRoomCallInProgress = useMemo(
    () =>
      !inOurSession &&
      idleRoomParticipantCount > 0 &&
      (callState === 'idle' || callState === 'error'),
    [callState, inOurSession, idleRoomParticipantCount],
  );

  return {
    callState,
    callSessionId,
    errorCode,
    screenshareErrorCode,
    dismissScreenshareError,
    dismissCallError,
    retryFromError,
    tabBackgroundWhileInCall,
    activeSpeakerKey,
    threadContext,
    callKind,
    enterAudio,
    enterVideo,
    leave,
    setMicrophoneMuted,
    setCameraMuted,
    setScreensharingEnabled,
    isScreensharing,
    localPreviewStream,
    /** Devices in the room’s GroupCall (or 0 if none). */
    roomGroupCallDeviceCount,
    /** For copy: when not in the call, all devices are “others”; when in call, max(0, n-1). */
    othersInRoomCallCount,
    /** Matrix user ids with at least one device in the call (room member state + local echo). */
    inCallUserIdsForRoster,
    showRoomCallInProgress,
    participantSummary: {
      count: roomGroupCallDeviceCount,
      others: othersInRoomCallCount,
    },
    isMicrophoneMuted,
    isLocalVideoMuted,
    groupCall,
    feedVersion,
  };
}
