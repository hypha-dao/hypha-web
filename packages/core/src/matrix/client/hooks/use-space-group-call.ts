'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as MatrixSdk from 'matrix-js-sdk';
import { RoomStateEvent } from 'matrix-js-sdk';
import { GroupCallEventHandlerEvent } from 'matrix-js-sdk/lib/webrtc/groupCallEventHandler';
import { useMatrix } from '../providers/matrix-provider';
import { isPermissionLikeGroupCallError } from './space-group-call-utils';
import { logSpaceGroupCallEvent } from './space-group-call-telemetry';
import { matrixGroupCallSummaryStatsMsFromEnv } from '../matrix-webrtc-env';
import {
  attachGroupCallWebRtcDiagnostics,
  probeMatrixTurnServerReadiness,
} from './group-call-webrtc-diagnostics';
import type { SpaceGroupCallState } from './space-group-call-state';

export type { SpaceGroupCallState } from './space-group-call-state';

export type SpaceGroupCallErrorCode =
  | 'NO_CLIENT'
  | 'NO_ROOM'
  | 'NOT_READY'
  | 'PERMISSION_DENIED'
  | 'WEBRTC_FAILED'
  | 'UNKNOWN';

const { GroupCallEvent, GroupCallIntent, GroupCallType, GroupCallState } =
  MatrixSdk;

/** Abort `gc.enter()` hang (SFU/TURN stuck) — user-recoverable via Retry. */
const CONNECT_STALL_ABORT_MS = 90_000;

/** Room shows others in-call but no remote userMedia CallFeed yet (signaling/WebRTC issue). */
const REMOTE_MEDIA_STALL_MS = 45_000;

/** Dev console: periodic sample of feeds vs participant map (not every Matrix event). */
const MEDIA_SNAPSHOT_INTERVAL_MS = 12_000;

/** Matrix SDK group-call summary stats interval (`NEXT_PUBLIC_MATRIX_WEBRTC_GROUP_STATS_MS`). */
const GROUP_WEBRTC_SUMMARY_STATS_MS = matrixGroupCallSummaryStatsMsFromEnv();

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
  /**
   * Tracks async GroupCall.leave() so a fast re-enter on the same room can await
   * teardown and avoid racing the SDK.
   */
  const leaveInFlightRef = useRef<Promise<void> | null>(null);
  const isJoiningRef = useRef(false);
  /** Batches rapid feed list events into one React update per frame (Phase 5.2). */
  const feedUpdateRafRef = useRef<number | null>(null);
  const lastJoinKindRef = useRef<'audio' | 'video' | null>(null);
  const lastThreadRootEventIdRef = useRef<string | undefined>(undefined);
  const joinStartedAtRef = useRef<number | null>(null);
  const lastRoomIdForTelemetryRef = useRef<string | null>(null);
  const activeGroupCallRoomIdRef = useRef<string | null>(null);
  const loggedStatsForGroupCallIdRef = useRef<string | null>(null);
  const webRtcDiagCleanupRef = useRef<(() => void) | null>(null);
  /** Cleared on enter or teardown — abort endless "Connecting…" when enter() hangs. */
  const connectingStallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  /** Dev / support: periodic media snapshots while connected (`setInterval`). */
  const mediaDebugIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  /** First time we saw others in participant map but no remote CallFeed (ms since epoch). */
  const remoteMediaGapSinceRef = useRef<number | null>(null);
  const remoteMediaStallLoggedRef = useRef(false);
  const remoteMediaStallBannerDismissedRef = useRef(false);
  const [remoteMediaStall, setRemoteMediaStall] = useState(false);

  const dismissRemoteMediaStallBanner = useCallback(() => {
    remoteMediaStallBannerDismissedRef.current = true;
    setRemoteMediaStall(false);
  }, []);
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

  const clearConnectingStallTimer = useCallback(() => {
    if (connectingStallTimerRef.current != null) {
      clearTimeout(connectingStallTimerRef.current);
      connectingStallTimerRef.current = null;
    }
  }, []);

  const clearMediaDebugInterval = useCallback(() => {
    if (mediaDebugIntervalRef.current != null) {
      clearInterval(mediaDebugIntervalRef.current);
      mediaDebugIntervalRef.current = null;
    }
  }, []);

  const runCleanup = useCallback(() => {
    clearConnectingStallTimer();
    clearMediaDebugInterval();
    webRtcDiagCleanupRef.current?.();
    webRtcDiagCleanupRef.current = null;
    remoteMediaGapSinceRef.current = null;
    remoteMediaStallLoggedRef.current = false;
    remoteMediaStallBannerDismissedRef.current = false;
    setRemoteMediaStall(false);
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
      const p = (async () => {
        try {
          await Promise.resolve((gc as MatrixSdk.GroupCall).leave());
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('[hypha.group_call] GroupCall.leave() rejected', err);
          }
        }
      })();
      leaveInFlightRef.current = p;
      p.finally(() => {
        if (leaveInFlightRef.current === p) {
          leaveInFlightRef.current = null;
        }
      });
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
  }, [clearConnectingStallTimer, clearMediaDebugInterval]);

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

  /**
   * @param excludeUserId — when the local user is **not** in-session (idle path),
   *   omit their row so a stale `participants` entry after `leave()` does not
   *   keep "call in progress" / Join UI visible (see Hypha join strip).
   */
  const readParticipantsFromGroupCall = useCallback(
    (gc: MatrixSdk.GroupCall, excludeUserId?: string | null) => {
      const userIdSet = new Set<string>();
      let deviceCount = 0;
      for (const [member, deviceMap] of gc.participants) {
        // Idle UI only: never count the local user as "others in a call you can join".
        if (excludeUserId && member.userId === excludeUserId) {
          continue;
        }
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

  /** Stall detection: others in participant map but no remote userMedia CallFeed (WebRTC lag). */
  const evalRemoteMediaStall = useCallback(() => {
    const gc = groupCallRef.current;
    if (!gc || !roomId?.trim() || !client) return;
    const myId = client.getUserId() ?? null;
    const remoteFeeds = gc.userMediaFeeds.filter((f) => !f.isLocal());
    const remoteIdsWithFeed = new Set(
      remoteFeeds.map((f) => f.userId).filter(Boolean) as string[],
    );
    const othersInCall = inCallUserIdsFromGroupCall(gc).filter(
      (id) => id && id !== myId,
    );
    const missingRemoteFeedCount = othersInCall.filter(
      (id) => !remoteIdsWithFeed.has(id),
    ).length;

    const now = Date.now();
    if (missingRemoteFeedCount > 0 && othersInCall.length > 0) {
      if (remoteMediaGapSinceRef.current == null) {
        remoteMediaGapSinceRef.current = now;
      }
      const waitedMs = now - remoteMediaGapSinceRef.current;
      if (
        waitedMs >= REMOTE_MEDIA_STALL_MS &&
        !remoteMediaStallLoggedRef.current
      ) {
        remoteMediaStallLoggedRef.current = true;
        logSpaceGroupCallEvent({
          name: 'hypha.group_call.remote_media_stall',
          roomId,
          kind: lastJoinKindRef.current ?? undefined,
          groupCallId: gc.groupCallId,
          missingRemoteFeedCount,
          waitedMs,
        });
        if (!remoteMediaStallBannerDismissedRef.current) {
          setRemoteMediaStall(true);
        }
      }
    } else {
      remoteMediaGapSinceRef.current = null;
      remoteMediaStallLoggedRef.current = false;
      remoteMediaStallBannerDismissedRef.current = false;
      setRemoteMediaStall(false);
    }
  }, [
    client,
    roomId,
    inCallUserIdsFromGroupCall,
    readParticipantsFromGroupCall,
  ]);

  const logDevMediaSnapshot = useCallback(() => {
    const gc = groupCallRef.current;
    if (!gc || !roomId?.trim() || !client) return;
    const myId = client.getUserId() ?? null;
    const remoteFeeds = gc.userMediaFeeds.filter((f) => !f.isLocal());
    const remoteIdsWithFeed = new Set(
      remoteFeeds.map((f) => f.userId).filter(Boolean) as string[],
    );
    const othersInCall = inCallUserIdsFromGroupCall(gc).filter(
      (id) => id && id !== myId,
    );
    const missingRemoteFeedCount = othersInCall.filter(
      (id) => !remoteIdsWithFeed.has(id),
    ).length;
    logSpaceGroupCallEvent({
      name: 'hypha.group_call.media_snapshot',
      roomId,
      kind: lastJoinKindRef.current ?? undefined,
      groupCallId: gc.groupCallId,
      userMediaFeedCount: gc.userMediaFeeds.length,
      remoteUserMediaFeedCount: remoteFeeds.length,
      screenshareFeedCount: gc.screenshareFeeds.length,
      participantDeviceCount: readParticipantsFromGroupCall(gc).count,
      missingRemoteFeedCount,
    });
  }, [
    client,
    roomId,
    inCallUserIdsFromGroupCall,
    readParticipantsFromGroupCall,
  ]);

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
        evalRemoteMediaStall();
      });
      const onFeedsMaybeParticipants = () => {
        scheduleFeedBatched();
        updateParticipantCount();
        evalRemoteMediaStall();
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
      evalRemoteMediaStall,
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

      if (leaveInFlightRef.current) {
        try {
          await leaveInFlightRef.current;
        } catch {
          // leave() rejection already logged in runCleanup
        }
      }

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
        setIsScreensharing(false);
        setScreenshareErrorCode(null);
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

      clearConnectingStallTimer();
      connectingStallTimerRef.current = setTimeout(() => {
        clearConnectingStallTimer();
        if (groupCallRef.current !== gc) return;
        if (process.env.NODE_ENV === 'development') {
          console.warn('[hypha.group_call] enter() stalled — forcing cleanup', {
            roomId,
            ms: CONNECT_STALL_ABORT_MS,
          });
        }
        isJoiningRef.current = false;
        setErrorCode('UNKNOWN');
        if (roomId) {
          logSpaceGroupCallEvent({
            name: 'hypha.group_call.error',
            roomId,
            kind,
            errorCode: 'CONNECT_STALL',
          });
        }
        setCallState('error');
        runCleanup();
        setCallKind(null);
        setThreadContext(null);
        joinStartedAtRef.current = null;
      }, CONNECT_STALL_ABORT_MS);

      try {
        await gc.enter();
      } catch (e) {
        clearConnectingStallTimer();
        isJoiningRef.current = false;
        const permissionLike = isPermissionLikeGroupCallError(e);
        if (permissionLike) {
          setErrorCode('PERMISSION_DENIED');
        } else {
          setErrorCode('WEBRTC_FAILED');
        }
        if (roomId) {
          logSpaceGroupCallEvent({
            name: 'hypha.group_call.error',
            roomId,
            kind,
            errorCode: permissionLike ? 'PERMISSION_DENIED' : 'WEBRTC_FAILED',
          });
        }
        setCallState('error');
        runCleanup();
        setCallKind(null);
        setThreadContext(null);
        joinStartedAtRef.current = null;
        return;
      }

      clearConnectingStallTimer();

      webRtcDiagCleanupRef.current?.();
      webRtcDiagCleanupRef.current = null;
      if (GROUP_WEBRTC_SUMMARY_STATS_MS > 0) {
        webRtcDiagCleanupRef.current = attachGroupCallWebRtcDiagnostics({
          gc,
          roomId,
          summaryStatsIntervalMs: GROUP_WEBRTC_SUMMARY_STATS_MS,
        });
      }

      void probeMatrixTurnServerReadiness({ client, roomId, kind });

      setCallState('connected');
      refreshLocalPreview();
      updateParticipantCount();
      setIsMicrophoneMuted(gc.isMicrophoneMuted());
      setIsLocalVideoMuted(gc.isLocalVideoMuted());
      setActiveKeyFromGroupCall(gc);
      isJoiningRef.current = false;
      lastRoomIdForTelemetryRef.current = roomId;

      if (roomId) {
        logSpaceGroupCallEvent({
          name: 'hypha.group_call.connected',
          roomId,
          kind,
          groupCallId: gc.groupCallId,
        });
      }
      logDevMediaSnapshot();
      evalRemoteMediaStall();

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
      logDevMediaSnapshot,
      evalRemoteMediaStall,
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
        // Stopping share is user-initiated; the SDK can report `false` without a real failure.
        if (enabled && ok === false) {
          setScreenshareErrorCode('WEBRTC_FAILED');
        }
      } catch (e) {
        if (!enabled) {
          setScreenshareErrorCode(null);
          scheduleFeedBatched();
          return;
        }
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

  /**
   * Room member `m.call.*` state is applied asynchronously in the GroupCall. When
   * `updateParticipants` runs, `participants` updates but `ParticipantsChanged`
   * may not re-fire. Re-sync the banner count on every room state update while in a call.
   */
  useEffect(() => {
    if (!client || !roomId?.trim()) return;
    const inCall =
      callState === 'connecting' ||
      callState === 'connected' ||
      callState === 'awaiting_media' ||
      callState === 'initializing' ||
      callState === 'disconnecting';
    if (!inCall) return;
    const room = client.getRoom(roomId);
    if (!room) return;
    const bump = () => {
      updateParticipantCount();
      evalRemoteMediaStall();
    };
    room.on(RoomStateEvent.Update, bump);
    return () => {
      room.off(RoomStateEvent.Update, bump);
    };
  }, [client, roomId, callState, updateParticipantCount, evalRemoteMediaStall]);

  /** Dev: periodic feed vs participant-map snapshots while connected. */
  useEffect(() => {
    if (callState !== 'connected') {
      clearMediaDebugInterval();
      return;
    }
    logDevMediaSnapshot();
    mediaDebugIntervalRef.current = setInterval(() => {
      logDevMediaSnapshot();
      evalRemoteMediaStall();
    }, MEDIA_SNAPSHOT_INTERVAL_MS);
    return () => {
      clearMediaDebugInterval();
    };
  }, [
    callState,
    roomId,
    clearMediaDebugInterval,
    logDevMediaSnapshot,
    evalRemoteMediaStall,
  ]);

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

    const myId = client.getUserId() ?? null;
    /** Which idle `GroupCall` we attach `ParticipantsChanged` to (may appear after sync). */
    let watchedGroupCall: MatrixSdk.GroupCall | null = null;

    const unwatchParticipants = () => {
      if (watchedGroupCall) {
        watchedGroupCall.removeListener(
          GroupCallEvent.ParticipantsChanged,
          sync,
        );
        watchedGroupCall = null;
      }
    };

    const watchParticipantsOn = (gc: MatrixSdk.GroupCall | null) => {
      if (watchedGroupCall === gc) return;
      unwatchParticipants();
      watchedGroupCall = gc;
      if (gc) {
        gc.on(GroupCallEvent.ParticipantsChanged, sync);
      }
    };

    const sync = () => {
      if (groupCallRef.current) {
        return;
      }
      const current = client.getGroupCallForRoom(roomId);
      watchParticipantsOn(current ?? null);
      if (!current) {
        setIdleRoomParticipantCount(0);
        setIdleInCallUserIds([]);
        return;
      }
      const p = readParticipantsFromGroupCall(current, myId);
      if (p.count === 0) {
        setIdleRoomParticipantCount(0);
        setIdleInCallUserIds([]);
        return;
      }
      setIdleRoomParticipantCount(p.count);
      setIdleInCallUserIds(p.inCallUserIds);
    };

    const onIncoming = (incoming: MatrixSdk.GroupCall) => {
      if (incoming.room?.roomId !== roomId) return;
      /* `GroupCallEventHandler` may emit this before `getGroupCallForRoom` is populated in edge races. */
      watchParticipantsOn(incoming);
      sync();
    };

    const onEnded = (ended: MatrixSdk.GroupCall) => {
      if (ended.room?.roomId !== roomId) return;
      unwatchParticipants();
      sync();
    };

    /* Subscribe before the first `sync` so we do not miss `GroupCall.incoming` (was "alone until reload"). */
    client.on(
      GroupCallEventHandlerEvent.Incoming,
      onIncoming as (c: MatrixSdk.GroupCall) => void,
    );
    client.on(
      GroupCallEventHandlerEvent.Ended,
      onEnded as (ended: MatrixSdk.GroupCall) => void,
    );
    sync();

    const unsub = () => {
      unwatchParticipants();
      client.removeListener(
        GroupCallEventHandlerEvent.Incoming,
        onIncoming as (c: MatrixSdk.GroupCall) => void,
      );
      client.removeListener(
        GroupCallEventHandlerEvent.Ended,
        onEnded as (ended: MatrixSdk.GroupCall) => void,
      );
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
    /** Matrix lists others in-call but no remote media after threshold — likely WebRTC/signaling. */
    remoteMediaStall,
    dismissRemoteMediaStallBanner,
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
