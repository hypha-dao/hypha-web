'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as MatrixSdk from 'matrix-js-sdk';
import { ClientEvent, RoomStateEvent } from 'matrix-js-sdk';
import { GroupCallEventHandlerEvent } from 'matrix-js-sdk/lib/webrtc/groupCallEventHandler';
import { useMatrix } from '../providers/matrix-provider';
import { isPermissionLikeGroupCallError } from './space-group-call-utils';
import { logSpaceGroupCallEvent } from './space-group-call-telemetry';
import { matrixGroupCallSummaryStatsMsFromEnv } from '../matrix-webrtc-env';
import {
  attachGroupCallWebRtcDiagnostics,
  probeMatrixTurnServerReadiness,
} from './group-call-webrtc-diagnostics';
import {
  startBrowserCallTranscription,
  startGroupCallRecording,
  uploadRecordedCallArtifact,
} from './call-recording';
import type { SpaceGroupCallState } from './space-group-call-state';

export type { SpaceGroupCallState } from './space-group-call-state';

export type SpaceGroupCallErrorCode =
  | 'NO_CLIENT'
  | 'NO_ROOM'
  | 'NOT_READY'
  | 'PERMISSION_DENIED'
  | 'CONNECT_STALL'
  | 'WEBRTC_FAILED'
  | 'UNKNOWN';

const { GroupCallEvent, GroupCallIntent, GroupCallType, GroupCallState } =
  MatrixSdk;

/** Abort `gc.enter()` hang (SFU/TURN stuck) — user-recoverable via Retry. */
const CONNECT_STALL_ABORT_MS = 90_000;

/** Room shows others in-call but no remote userMedia CallFeed yet (signaling/WebRTC issue). */
const REMOTE_MEDIA_STALL_MS = 45_000;
const REMOTE_MEDIA_REPAIR_NUDGE_MS = 1500;
const REMOTE_MEDIA_AUTO_RECOVER_MS = 70_000;

/** Dev console: periodic sample of feeds vs participant map (not every Matrix event). */
const MEDIA_SNAPSHOT_INTERVAL_MS = 12_000;

/**
 * Matrix group calls use pairwise VoIP: the lexicographically higher MXID places
 * outbound `m.call.*` to the lower. `placeOutgoingCalls()` runs on participant
 * updates; a tight race on join can skip the first attempt and leave only one
 * side with media until reload. Nudge once after enter + optional delayed retry.
 */
const PLACE_OUTGOING_DELAYED_MS = 600;
const PLACE_OUTGOING_RETRY_MS = [1500, 4000, 8000] as const;
const ROOM_CALL_PERMISSION_REPAIR_TIMEOUT_MS = 30_000;
const VOICE_PROCESSING_PRESET_KEY = 'hypha-group-call-voice-processing-v1';

export type SpaceGroupCallOptions = {
  authToken?: string | null;
  spaceSlug?: string | null;
};
export type SpaceGroupCallVoiceProcessingPreset =
  | 'standard'
  | 'voice_isolation'
  | 'music';
export type SpaceGroupCallRecordingStatus =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'error';

type AudioProcessingConstraints = {
  autoGainControl: boolean;
  echoCancellation: boolean;
  noiseSuppression: boolean;
};

function constraintsForVoicePreset(
  preset: SpaceGroupCallVoiceProcessingPreset,
): AudioProcessingConstraints {
  switch (preset) {
    case 'voice_isolation':
      return {
        autoGainControl: false,
        echoCancellation: true,
        noiseSuppression: true,
      };
    case 'music':
      return {
        autoGainControl: false,
        echoCancellation: true,
        noiseSuppression: false,
      };
    case 'standard':
    default:
      return {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      };
  }
}

function readVoiceProcessingPreset(): SpaceGroupCallVoiceProcessingPreset {
  if (typeof window === 'undefined') return 'standard';
  try {
    const raw = window.localStorage
      .getItem(VOICE_PROCESSING_PRESET_KEY)
      ?.trim();
    if (raw === 'standard' || raw === 'voice_isolation' || raw === 'music') {
      return raw;
    }
  } catch {
    // ignore persistence read failures
  }
  return 'standard';
}

function persistVoiceProcessingPreset(
  preset: SpaceGroupCallVoiceProcessingPreset,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VOICE_PROCESSING_PRESET_KEY, preset);
  } catch {
    // ignore persistence write failures
  }
}

async function tryRepairRoomCallPermissions(
  authToken: string | null | undefined,
  spaceSlug: string | null | undefined,
  roomId: string,
): Promise<boolean> {
  const token = authToken?.trim();
  const slug = spaceSlug?.trim();
  if (!token || !slug) return false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, ROOM_CALL_PERMISSION_REPAIR_TIMEOUT_MS);
  try {
    const response = await fetch('/api/matrix/room-call-permissions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roomId, spaceSlug: slug }),
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
    } | null;
    return data?.ok === true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return false;
    }
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

function nudgeGroupCallPlaceOutgoing(gc: MatrixSdk.GroupCall): void {
  const fn = (gc as unknown as { placeOutgoingCalls?: () => void })
    .placeOutgoingCalls;
  if (typeof fn !== 'function') return;
  try {
    fn.call(gc);
  } catch {
    /* ignore */
  }
}

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

export function useSpaceGroupCall(
  roomId: string | null,
  options: SpaceGroupCallOptions = {},
) {
  const { client } = useMatrix();
  const { authToken = null, spaceSlug = null } = options;

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
  const [voiceProcessingPreset, setVoiceProcessingPresetState] =
    useState<SpaceGroupCallVoiceProcessingPreset>('standard');
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
  const [recordingStatus, setRecordingStatus] =
    useState<SpaceGroupCallRecordingStatus>('idle');
  const [recordingError, setRecordingError] = useState<string | null>(null);

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
  const groupCallListenerCleanupRef = useRef<(() => void) | null>(null);
  /** Cleared in runCleanup — delayed second `placeOutgoingCalls` nudge after enter(). */
  const placeOutgoingNudgeTimerRef = useRef<number | null>(null);
  /** Additional pairwise call-placement retries for rejoin/refresh races. */
  const placeOutgoingRetryTimerRefs = useRef<number[]>([]);
  /**
   * Bumped when starting a join and when the stall watchdog fires — stale
   * `await gc.enter()` must not run success paths after forced cleanup.
   */
  const joinEpochRef = useRef(0);
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
  const remoteMediaRepairNudgeIntervalRef = useRef<ReturnType<
    typeof setInterval
  > | null>(null);
  const remoteMediaRecoverRequestedRef = useRef(false);
  const remoteMediaRecoverAttemptedRef = useRef(false);
  const remoteMediaRecoverInFlightRef = useRef(false);
  const recordingGenerationRef = useRef(0);
  const recordingFinalizeInFlightRef = useRef(false);
  const recordingFinalizeGenerationRef = useRef<number | null>(null);
  const recordingRuntimeRef = useRef<{
    generation: number;
    stopRecorder: () => Promise<Blob>;
    stopTranscript: () => Promise<string> | string;
    mimeType: string;
    startedAt: string;
    recordedRoomId: string;
  } | null>(null);
  const [remoteMediaRecoverNonce, setRemoteMediaRecoverNonce] = useState(0);
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
    const runtime = recordingRuntimeRef.current;
    const runtimeGeneration = runtime?.generation ?? null;
    if (
      recordingFinalizeInFlightRef.current &&
      runtimeGeneration != null &&
      recordingFinalizeGenerationRef.current === runtimeGeneration
    ) {
      return;
    }

    const token = authToken?.trim();
    const slug = spaceSlug?.trim();
    const activeRoomId = runtime?.recordedRoomId?.trim() || roomId?.trim();
    if (!runtime) {
      recordingRuntimeRef.current = null;
      setRecordingStatus('idle');
    } else if (!token || !slug || !activeRoomId) {
      recordingRuntimeRef.current = null;
      void (async () => {
        try {
          await runtime.stopRecorder();
        } catch {
          // ignore recorder stop errors during teardown-only cleanup
        }
        try {
          await runtime.stopTranscript();
        } catch {
          // ignore transcript stop errors during teardown-only cleanup
        }
        if (!recordingFinalizeInFlightRef.current) {
          setRecordingStatus('idle');
          setRecordingError(null);
        }
      })();
    } else {
      const cleanupGeneration = runtime.generation;
      recordingFinalizeInFlightRef.current = true;
      recordingFinalizeGenerationRef.current = cleanupGeneration;
      recordingRuntimeRef.current = null;
      setRecordingStatus('uploading');
      void (async () => {
        try {
          const endedAt = new Date().toISOString();
          const blob = await runtime.stopRecorder();
          const transcriptText = await runtime.stopTranscript();
          if (blob.size === 0) {
            throw new Error('recording blob is empty');
          }
          const sessionId = callSessionId ?? newCallSessionId();
          await uploadRecordedCallArtifact({
            authToken: token,
            spaceSlug: slug,
            roomId: activeRoomId,
            callSessionId: sessionId,
            blob,
            mimeType: runtime.mimeType,
            transcriptText,
            startedAt: runtime.startedAt,
            endedAt,
          });
          if (recordingFinalizeGenerationRef.current === cleanupGeneration) {
            setRecordingStatus('idle');
            setRecordingError(null);
          }
        } catch (error) {
          if (recordingFinalizeGenerationRef.current === cleanupGeneration) {
            setRecordingStatus('error');
            setRecordingError(
              error instanceof Error ? error.message : String(error),
            );
          }
        } finally {
          if (recordingFinalizeGenerationRef.current === cleanupGeneration) {
            recordingFinalizeInFlightRef.current = false;
            recordingFinalizeGenerationRef.current = null;
          }
        }
      })();
    }

    clearConnectingStallTimer();
    clearMediaDebugInterval();
    if (placeOutgoingNudgeTimerRef.current != null) {
      clearTimeout(placeOutgoingNudgeTimerRef.current);
      placeOutgoingNudgeTimerRef.current = null;
    }
    if (placeOutgoingRetryTimerRefs.current.length > 0) {
      for (const id of placeOutgoingRetryTimerRefs.current) {
        clearTimeout(id);
      }
      placeOutgoingRetryTimerRefs.current = [];
    }
    webRtcDiagCleanupRef.current?.();
    webRtcDiagCleanupRef.current = null;
    groupCallListenerCleanupRef.current?.();
    groupCallListenerCleanupRef.current = null;
    remoteMediaGapSinceRef.current = null;
    remoteMediaStallLoggedRef.current = false;
    remoteMediaStallBannerDismissedRef.current = false;
    if (remoteMediaRepairNudgeIntervalRef.current != null) {
      clearInterval(remoteMediaRepairNudgeIntervalRef.current);
      remoteMediaRepairNudgeIntervalRef.current = null;
    }
    remoteMediaRecoverRequestedRef.current = false;
    remoteMediaRecoverAttemptedRef.current = false;
    remoteMediaRecoverInFlightRef.current = false;
    setRemoteMediaStall(false);
    if (feedUpdateRafRef.current != null) {
      cancelAnimationFrame(feedUpdateRafRef.current);
      feedUpdateRafRef.current = null;
    }
    const gc = groupCallRef.current;
    if (gc) {
      const p = (async () => {
        try {
          await Promise.resolve((gc as MatrixSdk.GroupCall).leave());
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('[hypha.group_call] GroupCall.leave() rejected', err);
          }
        }
        try {
          await Promise.resolve(
            (
              gc as MatrixSdk.GroupCall & { cleanMemberState?: () => void }
            ).cleanMemberState?.(),
          );
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.debug(
              '[hypha.group_call] GroupCall.cleanMemberState() rejected',
              err,
            );
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
    if (!recordingFinalizeInFlightRef.current) {
      setRecordingStatus('idle');
      setRecordingError(null);
    }
    loggedStatsForGroupCallIdRef.current = null;
    lastRoomIdForTelemetryRef.current = null;
  }, [
    authToken,
    callSessionId,
    clearConnectingStallTimer,
    clearMediaDebugInterval,
    roomId,
    spaceSlug,
  ]);

  const refreshLocalPreview = useCallback(() => {
    const gc = groupCallRef.current;
    if (!gc) {
      setLocalPreviewStream(null);
      return;
    }
    const feed = gc.localCallFeed;
    setLocalPreviewStream(feed?.stream ?? null);
  }, []);

  const applyVoiceProcessingPresetToGroupCall = useCallback(
    async (
      gc: MatrixSdk.GroupCall,
      preset: SpaceGroupCallVoiceProcessingPreset,
    ): Promise<boolean> => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        return false;
      }
      const existingStream = gc.localCallFeed?.stream ?? null;
      const previousAudioTrack = existingStream?.getAudioTracks()[0] ?? null;
      const videoTracks =
        existingStream?.getVideoTracks().filter((track) => {
          return track.readyState === 'live';
        }) ?? [];
      const audioConstraints = constraintsForVoicePreset(preset);
      const refreshedAudioStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          autoGainControl: { ideal: audioConstraints.autoGainControl },
          echoCancellation: { ideal: audioConstraints.echoCancellation },
          noiseSuppression: { ideal: audioConstraints.noiseSuppression },
        },
      });
      const nextAudioTrack = refreshedAudioStream.getAudioTracks()[0];
      if (!nextAudioTrack) {
        refreshedAudioStream.getTracks().forEach((track) => track.stop());
        return false;
      }
      if (previousAudioTrack) {
        nextAudioTrack.enabled = previousAudioTrack.enabled;
      }
      const nextStream = new MediaStream();
      nextStream.addTrack(nextAudioTrack);
      for (const videoTrack of videoTracks) {
        nextStream.addTrack(videoTrack);
      }
      try {
        await gc.updateLocalUsermediaStream(nextStream);
      } catch (error) {
        for (const track of refreshedAudioStream.getTracks()) {
          track.stop();
        }
        for (const track of nextStream.getTracks()) {
          if (track !== nextAudioTrack) continue;
          if (track.readyState !== 'ended') {
            track.stop();
          }
        }
        throw error;
      }
      for (const track of refreshedAudioStream.getTracks()) {
        if (track !== nextAudioTrack) {
          track.stop();
        }
      }
      if (previousAudioTrack && previousAudioTrack !== nextAudioTrack) {
        previousAudioTrack.stop();
      }
      return true;
    },
    [],
  );

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
      if (remoteMediaRepairNudgeIntervalRef.current == null) {
        remoteMediaRepairNudgeIntervalRef.current = setInterval(() => {
          if (groupCallRef.current !== gc) return;
          nudgeGroupCallPlaceOutgoing(gc);
        }, REMOTE_MEDIA_REPAIR_NUDGE_MS);
      }
      /**
       * The SDK can know the remote participant from group-call member state
       * while the pairwise `MatrixCall` never finishes selecting an opponent
       * (candidates get buffered, no CallFeed arrives). Retry placement from
       * the stalled side as well as from ParticipantsChanged/room-state bumps.
       */
      nudgeGroupCallPlaceOutgoing(gc);
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
      if (
        waitedMs >= REMOTE_MEDIA_AUTO_RECOVER_MS &&
        !remoteMediaRecoverAttemptedRef.current &&
        !remoteMediaRecoverInFlightRef.current
      ) {
        remoteMediaRecoverAttemptedRef.current = true;
        remoteMediaRecoverRequestedRef.current = true;
        setRemoteMediaRecoverNonce((value) => value + 1);
      }
    } else {
      remoteMediaGapSinceRef.current = null;
      remoteMediaStallLoggedRef.current = false;
      remoteMediaStallBannerDismissedRef.current = false;
      if (remoteMediaRepairNudgeIntervalRef.current != null) {
        clearInterval(remoteMediaRepairNudgeIntervalRef.current);
        remoteMediaRepairNudgeIntervalRef.current = null;
      }
      setRemoteMediaStall(false);
    }
  }, [client, roomId, inCallUserIdsFromGroupCall]);

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
      groupCallListenerCleanupRef.current?.();
      groupCallListenerCleanupRef.current = null;

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
      const onLocalScreenshareStateChanged = (sharing: boolean) => {
        setIsScreensharing(sharing);
      };
      gc.on(
        GroupCallEvent.LocalScreenshareStateChanged,
        onLocalScreenshareStateChanged,
      );
      const onParticipantsChanged = () => {
        updateParticipantCount();
        evalRemoteMediaStall();
        /** Pairwise VoIP: roster changes can arrive after the internal nudge — retry outbound setup. */
        nudgeGroupCallPlaceOutgoing(gc);
      };
      gc.on(GroupCallEvent.ParticipantsChanged, onParticipantsChanged);
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
      const onLocalMuteStateChanged = (
        audioMuted: boolean,
        videoMuted: boolean,
      ) => {
        setIsMicrophoneMuted(audioMuted);
        setIsLocalVideoMuted(videoMuted);
      };
      gc.on(GroupCallEvent.LocalMuteStateChanged, onLocalMuteStateChanged);

      groupCallListenerCleanupRef.current = () => {
        gc.removeListener(GroupCallEvent.Error, onError);
        gc.removeListener(GroupCallEvent.GroupCallStateChanged, onState);
        gc.removeListener(
          GroupCallEvent.LocalScreenshareStateChanged,
          onLocalScreenshareStateChanged,
        );
        gc.removeListener(
          GroupCallEvent.ParticipantsChanged,
          onParticipantsChanged,
        );
        gc.removeListener(
          GroupCallEvent.UserMediaFeedsChanged,
          onFeedsMaybeParticipants,
        );
        gc.removeListener(
          GroupCallEvent.ScreenshareFeedsChanged,
          onFeedsMaybeParticipants,
        );
        gc.removeListener(GroupCallEvent.ActiveSpeakerChanged, onActiveSpeaker);
        gc.removeListener(
          GroupCallEvent.LocalMuteStateChanged,
          onLocalMuteStateChanged,
        );
      };
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
    async (
      kind: 'audio' | 'video',
      threadRootEventId?: string,
      options?: { preserveRemoteMediaRecoverInFlight?: boolean },
    ) => {
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

      joinEpochRef.current += 1;
      const joinEpoch = joinEpochRef.current;

      isJoiningRef.current = true;
      remoteMediaRecoverRequestedRef.current = false;
      remoteMediaRecoverAttemptedRef.current = false;
      if (!options?.preserveRemoteMediaRecoverInFlight) {
        remoteMediaRecoverInFlightRef.current = false;
      }
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
      if (gc) {
        const myId = client.getUserId() ?? null;
        const activeOthers = readParticipantsFromGroupCall(gc, myId).count;
        if (activeOthers === 0) {
          try {
            await Promise.resolve(
              (
                gc as MatrixSdk.GroupCall & { terminate?: () => void }
              ).terminate?.(),
            );
          } catch {
            /* stale local group call cleanup is best-effort */
          }
          gc = client.getGroupCallForRoom(roomId);
        }
      }

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
            let nextErrorCode: SpaceGroupCallErrorCode =
              isPermissionLikeGroupCallError(e)
                ? 'PERMISSION_DENIED'
                : 'UNKNOWN';
            if (nextErrorCode === 'PERMISSION_DENIED') {
              const repaired = await tryRepairRoomCallPermissions(
                authToken,
                spaceSlug,
                roomId,
              );
              if (repaired) {
                try {
                  gc = await client.createGroupCall(
                    roomId,
                    type,
                    false,
                    GroupCallIntent.Room,
                  );
                } catch (retryError) {
                  if (
                    retryError instanceof Error &&
                    retryError.message.includes(
                      'already has an existing group call',
                    )
                  ) {
                    gc = client.getGroupCallForRoom(roomId);
                  } else {
                    nextErrorCode = isPermissionLikeGroupCallError(retryError)
                      ? 'PERMISSION_DENIED'
                      : 'UNKNOWN';
                  }
                }
              }
            }
            if (!gc) {
              isJoiningRef.current = false;
              setErrorCode(nextErrorCode);
              setCallSessionId(null);
              if (roomId) {
                logSpaceGroupCallEvent({
                  name: 'hypha.group_call.error',
                  roomId,
                  kind,
                  errorCode: nextErrorCode,
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

      /**
       * Voice vs video share one room group call. If the first joiner created
       * `m.voice`, the SDK only requests camera when `type === Video`. Upgrade
       * room state to `m.video` when joining with video. Never downgrade to
       * `m.voice` if the call is already video (audio join = local video off only).
       */
      if (kind === 'video' && gc.type !== GroupCallType.Video) {
        const prevType = gc.type;
        /** SDK method is private on `GroupCall`; intersecting types collapses to `never`. */
        const gcSync = gc as unknown as {
          type: MatrixSdk.GroupCall['type'];
          sendCallStateEvent(): Promise<void>;
        };
        gcSync.type = GroupCallType.Video;
        try {
          await gcSync.sendCallStateEvent();
          if (roomId) {
            logSpaceGroupCallEvent({
              name: 'hypha.group_call.room_type_sync',
              roomId,
              kind,
              groupCallId: gc.groupCallId,
              previousRoomGroupCallType: String(prevType),
              roomGroupCallType: String(GroupCallType.Video),
            });
          }
        } catch (e) {
          const permissionLike = isPermissionLikeGroupCallError(e);
          gcSync.type = prevType;
          isJoiningRef.current = false;
          setErrorCode(permissionLike ? 'PERMISSION_DENIED' : 'UNKNOWN');
          setCallSessionId(null);
          if (roomId) {
            logSpaceGroupCallEvent({
              name: 'hypha.group_call.error',
              roomId,
              kind,
              errorCode: permissionLike
                ? 'PERMISSION_DENIED'
                : 'ROOM_TYPE_SYNC',
            });
          }
          setCallState('error');
          setCallKind(null);
          setThreadContext(null);
          joinStartedAtRef.current = null;
          return;
        }
      }

      type GroupCallPreEnterMute = {
        initWithVideoMuted: boolean;
        initWithAudioMuted: boolean;
      };
      const gci = gc as unknown as GroupCallPreEnterMute;
      gci.initWithVideoMuted = kind === 'audio';
      gci.initWithAudioMuted = false;
      /**
       * Refresh stale local member state after hard reloads. If the prior tab died
       * mid-call, old device entries can survive briefly and cause asymmetric media.
       */
      try {
        await Promise.resolve(
          (
            gc as MatrixSdk.GroupCall & { cleanMemberState?: () => void }
          ).cleanMemberState?.(),
        );
      } catch {
        /* best-effort pre-enter cleanup */
      }

      groupCallRef.current = gc;
      activeGroupCallRoomIdRef.current = roomId;
      setGroupCall(gc);
      attachGroupCallListeners(gc);
      updateParticipantCount();
      setCallState('connecting');

      /**
       * Probe TURN before `enter()`: missing homeserver TURN config often makes
       * `gc.enter()` stall, so post-enter diagnostics would never be emitted.
       */
      void probeMatrixTurnServerReadiness({ client, roomId, kind });

      clearConnectingStallTimer();
      connectingStallTimerRef.current = setTimeout(() => {
        clearConnectingStallTimer();
        joinEpochRef.current += 1;
        if (groupCallRef.current !== gc) return;
        if (process.env.NODE_ENV === 'development') {
          console.warn('[hypha.group_call] enter() stalled — forcing cleanup', {
            roomId,
            ms: CONNECT_STALL_ABORT_MS,
          });
        }
        isJoiningRef.current = false;
        setErrorCode('CONNECT_STALL');
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
        if (joinEpoch !== joinEpochRef.current || groupCallRef.current !== gc) {
          isJoiningRef.current = false;
          return;
        }
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

      if (joinEpoch !== joinEpochRef.current || groupCallRef.current !== gc) {
        isJoiningRef.current = false;
        return;
      }

      try {
        await applyVoiceProcessingPresetToGroupCall(gc, voiceProcessingPreset);
      } catch {
        // keep the call connected if browser denies advanced audio constraints
      }
      /**
       * Voice→video: request camera explicitly after the post-enter voice preset step.
       * `applyVoiceProcessingPresetToGroupCall()` can replace local streams, so running
       * camera recovery after that avoids settling in an audio-only stream on direct
       * video joins.
       */
      if (kind === 'video') {
        try {
          const hasLiveLocalVideoTrack = () => {
            const track = gc.localCallFeed?.stream.getVideoTracks()[0];
            return Boolean(track && track.readyState === 'live');
          };
          /**
           * Avoid unnecessary camera churn: if `enter()` already yielded a live
           * local video track, forcing another `setLocalVideoMuted(false)` can
           * cause a visible video→black→video flash.
           */
          if (gc.isLocalVideoMuted() || !hasLiveLocalVideoTrack()) {
            await gc.setLocalVideoMuted(false);
          }
          /**
           * Direct video-join can occasionally land in a stale local video state
           * (black tile with a non-live track). Retry camera unmute once if no
           * live video track is present shortly after `enter()`.
           */
          if (!hasLiveLocalVideoTrack()) {
            await new Promise<void>((resolve) =>
              window.setTimeout(resolve, 320),
            );
            if (!hasLiveLocalVideoTrack()) {
              await gc.setLocalVideoMuted(true);
              await gc.setLocalVideoMuted(false);
            }
          }
        } catch {
          /* camera permission / hardware — remain in call with video off */
        }
      }

      nudgeGroupCallPlaceOutgoing(gc);
      if (typeof window !== 'undefined') {
        if (placeOutgoingNudgeTimerRef.current != null) {
          clearTimeout(placeOutgoingNudgeTimerRef.current);
        }
        placeOutgoingNudgeTimerRef.current = window.setTimeout(() => {
          placeOutgoingNudgeTimerRef.current = null;
          if (groupCallRef.current !== gc) return;
          nudgeGroupCallPlaceOutgoing(gc);
        }, PLACE_OUTGOING_DELAYED_MS);
        placeOutgoingRetryTimerRefs.current = PLACE_OUTGOING_RETRY_MS.map(
          (delayMs) =>
            window.setTimeout(() => {
              if (groupCallRef.current !== gc) return;
              nudgeGroupCallPlaceOutgoing(gc);
            }, delayMs),
        );
      }

      webRtcDiagCleanupRef.current?.();
      webRtcDiagCleanupRef.current = null;
      if (GROUP_WEBRTC_SUMMARY_STATS_MS > 0) {
        webRtcDiagCleanupRef.current = attachGroupCallWebRtcDiagnostics({
          gc,
          roomId,
          summaryStatsIntervalMs: GROUP_WEBRTC_SUMMARY_STATS_MS,
        });
      }

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
      authToken,
      client,
      spaceSlug,
      roomId,
      refreshLocalPreview,
      runCleanup,
      readParticipantsFromGroupCall,
      setActiveKeyFromGroupCall,
      updateParticipantCount,
      logDevMediaSnapshot,
      evalRemoteMediaStall,
      applyVoiceProcessingPresetToGroupCall,
      voiceProcessingPreset,
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
      window.setTimeout(scheduleFeedBatched, 350);
    },
    [scheduleFeedBatched],
  );

  const setCameraMuted = useCallback(
    async (muted: boolean) => {
      const gc = groupCallRef.current;
      if (!gc) return;
      if (!muted && gc.type !== GroupCallType.Video) {
        const prevType = gc.type;
        const gcSync = gc as unknown as {
          type: MatrixSdk.GroupCall['type'];
          sendCallStateEvent(): Promise<void>;
        };
        gcSync.type = GroupCallType.Video;
        try {
          await gcSync.sendCallStateEvent();
          if (roomId) {
            logSpaceGroupCallEvent({
              name: 'hypha.group_call.room_type_sync',
              roomId,
              kind: lastJoinKindRef.current ?? undefined,
              groupCallId: gc.groupCallId,
              previousRoomGroupCallType: String(prevType),
              roomGroupCallType: String(GroupCallType.Video),
            });
          }
        } catch {
          gcSync.type = prevType;
        }
      }
      await gc.setLocalVideoMuted(muted);
      if (!muted) {
        setCallKind('video');
        lastJoinKindRef.current = 'video';
        nudgeGroupCallPlaceOutgoing(gc);
      }
      setIsLocalVideoMuted(gc.isLocalVideoMuted());
      refreshLocalPreview();
      scheduleFeedBatched();
      window.setTimeout(() => {
        if (groupCallRef.current === gc && !gc.isLocalVideoMuted()) {
          nudgeGroupCallPlaceOutgoing(gc);
        }
        refreshLocalPreview();
        scheduleFeedBatched();
      }, 350);
    },
    [refreshLocalPreview, roomId, scheduleFeedBatched],
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

  const setVoiceProcessingPreset = useCallback(
    async (preset: SpaceGroupCallVoiceProcessingPreset) => {
      setVoiceProcessingPresetState(preset);
      persistVoiceProcessingPreset(preset);
      const gc = groupCallRef.current;
      if (!gc) return;
      try {
        const applied = await applyVoiceProcessingPresetToGroupCall(gc, preset);
        if (applied) {
          const hasLiveLocalVideoTrack = () => {
            const track = gc.localCallFeed?.stream.getVideoTracks()[0];
            return Boolean(track && track.readyState === 'live');
          };
          // Keep camera stable when audio preset swaps local streams mid-call.
          if (!gc.isLocalVideoMuted() && !hasLiveLocalVideoTrack()) {
            await gc.setLocalVideoMuted(false);
            await new Promise<void>((resolve) => {
              setTimeout(resolve, 220);
            });
            if (!hasLiveLocalVideoTrack()) {
              await gc.setLocalVideoMuted(true);
              await gc.setLocalVideoMuted(false);
            }
          }
          scheduleFeedBatched();
          refreshLocalPreview();
        }
      } catch {
        // keep current call media if constraints fail on this device/browser
      }
    },
    [
      applyVoiceProcessingPresetToGroupCall,
      refreshLocalPreview,
      scheduleFeedBatched,
    ],
  );

  useEffect(() => {
    setVoiceProcessingPresetState(readVoiceProcessingPreset());
  }, []);

  useEffect(() => {
    if (callState !== 'connected') return;
    if (recordingRuntimeRef.current) return;
    const gc = groupCallRef.current;
    const sessionId = callSessionId?.trim();
    const token = authToken?.trim();
    const slug = spaceSlug?.trim();
    const activeRoom = roomId?.trim();
    if (!gc || !sessionId || !token || !slug || !activeRoom) return;

    const recorder = startGroupCallRecording(gc);
    if (!recorder) {
      setRecordingStatus('error');
      setRecordingError('recording not supported by this browser');
      return;
    }
    const transcript = startBrowserCallTranscription({
      onError: () => {
        // recording continues even if speech recognition fails
      },
    });
    const generation = recordingGenerationRef.current + 1;
    recordingGenerationRef.current = generation;
    recordingRuntimeRef.current = {
      generation,
      stopRecorder: recorder.stop,
      stopTranscript: transcript.stop,
      mimeType: recorder.mimeType,
      startedAt: new Date().toISOString(),
      recordedRoomId: activeRoom,
    };
    setRecordingStatus('recording');
    setRecordingError(null);
  }, [authToken, callSessionId, callState, roomId, spaceSlug]);

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
   * may not re-fire. Re-sync the banner count and retry pairwise call placement
   * on every room state update while in a call.
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
      const gc = groupCallRef.current;
      if (gc) {
        nudgeGroupCallPlaceOutgoing(gc);
      }
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

  useEffect(() => {
    if (!remoteMediaRecoverRequestedRef.current) return;
    if (callState !== 'connected' && callState !== 'awaiting_media') return;
    if (isJoiningRef.current || remoteMediaRecoverInFlightRef.current) return;
    const retryKind = lastJoinKindRef.current;
    if (!retryKind) return;
    const retryThreadRootEventId = lastThreadRootEventIdRef.current;
    remoteMediaRecoverRequestedRef.current = false;
    if (roomId) {
      logSpaceGroupCallEvent({
        name: 'hypha.group_call.remote_media_recover',
        roomId,
        kind: retryKind,
      });
    }
    runCleanup();
    remoteMediaRecoverInFlightRef.current = true;
    setCallState('idle');
    setErrorCode(null);
    setCallKind(null);
    setIsScreensharing(false);
    setThreadContext(null);
    setParticipantCount(0);
    setScreenshareErrorCode(null);
    setTabBackgroundWhileInCall(false);
    void enterWithKind(retryKind, retryThreadRootEventId, {
      preserveRemoteMediaRecoverInFlight: true,
    }).finally(() => {
      if (!groupCallRef.current) {
        remoteMediaRecoverAttemptedRef.current = false;
      }
      remoteMediaRecoverInFlightRef.current = false;
    });
  }, [callState, enterWithKind, remoteMediaRecoverNonce, roomId, runCleanup]);

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

    /**
     * Last member leaving updates `m.group_call_member` state without always firing
     * `GroupCallEvent.ParticipantsChanged`, so the Join strip could stay stale.
     * Debounce — member state can fan out several updates per sync.
     */
    let idleRoomDebounce: ReturnType<typeof setTimeout> | null = null;
    const bumpIdleFromRoomState = () => {
      if (idleRoomDebounce != null) clearTimeout(idleRoomDebounce);
      idleRoomDebounce = setTimeout(() => {
        idleRoomDebounce = null;
        sync();
      }, 150);
    };

    const roomObj = client.getRoom(roomId);
    if (roomObj) {
      roomObj.on(RoomStateEvent.Update, bumpIdleFromRoomState);
    }
    client.on(ClientEvent.Sync, bumpIdleFromRoomState);

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
      if (idleRoomDebounce != null) clearTimeout(idleRoomDebounce);
      roomObj?.off(RoomStateEvent.Update, bumpIdleFromRoomState);
      client.removeListener(ClientEvent.Sync, bumpIdleFromRoomState);
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
    recordingStatus,
    recordingError,
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
    voiceProcessingPreset,
    setVoiceProcessingPreset,
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
