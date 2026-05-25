'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as MatrixSdk from 'matrix-js-sdk';
import { ClientEvent, RoomEvent, RoomStateEvent } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { GroupCallEventHandlerEvent } from 'matrix-js-sdk/lib/webrtc/groupCallEventHandler';
import { useMatrix } from '../providers/matrix-provider';
import { matrixMemberDisplayLabel } from '../../matrix-member-display';
import {
  isPermissionLikeGroupCallError,
  resolveMatrixSpeakerDisplayName,
  shouldIgnoreGroupCallErrorDuringCapture,
} from './space-group-call-utils';
import { logSpaceGroupCallEvent } from './space-group-call-telemetry';
import { matrixGroupCallSummaryStatsMsFromEnv } from '../matrix-webrtc-env';
import {
  attachGroupCallWebRtcDiagnostics,
  probeMatrixTurnServerReadiness,
} from './group-call-webrtc-diagnostics';
import {
  createCallRecording,
  startBrowserCallTranscription,
  uploadRecordedCallArtifact,
  uploadRecordedCallArtifactWithRetry,
} from './call-recording';
import {
  evaluateCallRecordingCaptureLimits,
  type CallRecordingLimitWarningCode,
} from '../../../assets/call-recording-limits';
import { downloadCallRecordingBackup } from '../../../assets/client/call-recording-local-backup';
import { CALL_RECORDING_MIN_FILE_SIZE_BYTES } from '../../../assets/call-recording-constants';
import type {
  SpaceGroupCallCaptureMode,
  SpaceGroupCallRecordingStatus,
  SpaceGroupCallState,
} from './space-group-call-state';
import {
  CALL_CAPTURE_NOTICE_TYPE,
  resolveActiveRoomCaptureFromEvents,
  resolveCaptureConsent,
  resolveLocalCaptureConsent,
  type SpaceGroupCallCaptureConsent,
} from './call-capture-consent';
import {
  buildScreenshareTakeoverContent,
  getRemoteScreenshareOwner,
  resolveIncomingScreenshareTakeover,
  resolveScreenshareTakeoverOutcome,
  type ScreenshareTakeoverIncoming,
} from './screenshare-takeover';
export type { SpaceGroupCallState } from './space-group-call-state';
export type {
  SpaceGroupCallCaptureMode,
  SpaceGroupCallRecordingStatus,
} from './space-group-call-state';
export type { SpaceGroupCallCaptureConsent } from './call-capture-consent';

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

const CAPTURE_START_STALL_MS = 8_000;
/** Minimum time capture must run before finalize produces a non-empty blob. */
const CAPTURE_MIN_DURATION_MS = 2_000;
const CAPTURE_LIMIT_CHECK_MS = 15_000;

type PendingRecordingUpload = {
  blob: Blob;
  mimeType: string;
  callSessionId: string;
  spaceSlug: string;
  roomId: string;
  authToken: string;
  transcriptText?: string;
  startedAt: string;
  endedAt: string;
  launchContext?: {
    signalTitle?: string;
    signalSlug?: string;
    threadRootEventId?: string;
  };
};

function isCaptureEligibleCallState(state: SpaceGroupCallState): boolean {
  return state === 'connected' || state === 'awaiting_media';
}

function abortStaleJoinAttempt(
  setCallState: (state: SpaceGroupCallState) => void,
) {
  setCallState('idle');
}

function abortInFlightJoin(
  joinEpochRef: { current: number },
  isJoiningRef: { current: boolean },
) {
  joinEpochRef.current += 1;
  isJoiningRef.current = false;
}

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
const PLACE_OUTGOING_RETRY_MS = [1500, 4000, 8000, 12000] as const;
/** Re-verify local tracks + nudge pairwise calls while WebRTC settles after join. */
const LOCAL_MEDIA_BOOTSTRAP_MS = [800, 2000, 5000, 10000] as const;
const ROOM_CALL_PERMISSION_REPAIR_TIMEOUT_MS = 30_000;
const VOICE_PROCESSING_PRESET_KEY = 'hypha-group-call-voice-processing-v1';
const CALL_CAPTURE_NOTICE_BODY = 'Hypha call capture notice';

export type SpaceGroupCallLaunchContext = {
  signalTitle?: string;
  signalSlug?: string;
  threadRootEventId?: string;
};

export type SpaceGroupCallOptions = {
  authToken?: string | null;
  spaceSlug?: string | null;
  /** Fired after call recording/transcript artifacts are persisted successfully. */
  onCallArtifactsUploaded?: (params: { spaceSlug: string }) => void;
  /** Optional launch context (signal title, thread root) for Space Memory display. */
  getCallLaunchContext?: () => SpaceGroupCallLaunchContext | null;
};
export type SpaceGroupCallVoiceProcessingPreset =
  | 'standard'
  | 'voice_isolation'
  | 'music';

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

function getLiveLocalVideoTrack(
  gc: MatrixSdk.GroupCall,
): MediaStreamTrack | null {
  const track = gc.localCallFeed?.stream.getVideoTracks()[0];
  return track && track.readyState === 'live' ? track : null;
}

async function waitForLiveLocalVideoTrack(
  gc: MatrixSdk.GroupCall,
  timeoutMs = 400,
): Promise<boolean> {
  if (getLiveLocalVideoTrack(gc)) return true;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
    if (getLiveLocalVideoTrack(gc)) return true;
  }
  return false;
}

/** Matrix SDK can leave a stale or missing track after camera off→on. */
async function recoverLocalCameraFeed(gc: MatrixSdk.GroupCall): Promise<void> {
  if (gc.isLocalVideoMuted()) return;
  if (getLiveLocalVideoTrack(gc)) return;

  await gc.setLocalVideoMuted(false);
  if (await waitForLiveLocalVideoTrack(gc, 220)) return;

  await gc.setLocalVideoMuted(true);
  await gc.setLocalVideoMuted(false);
  await waitForLiveLocalVideoTrack(gc, 400);
}

function getLiveLocalAudioTrack(
  gc: MatrixSdk.GroupCall,
): MediaStreamTrack | null {
  const track = gc.localCallFeed?.stream.getAudioTracks()[0];
  return track && track.readyState === 'live' ? track : null;
}

async function waitForLiveLocalAudioTrack(
  gc: MatrixSdk.GroupCall,
  timeoutMs = 400,
): Promise<boolean> {
  if (getLiveLocalAudioTrack(gc)) return true;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
    if (getLiveLocalAudioTrack(gc)) return true;
  }
  return false;
}

/** Matrix SDK can leave mic unmuted but without a live audio track after enter(). */
async function recoverLocalMicrophoneFeed(
  gc: MatrixSdk.GroupCall,
): Promise<void> {
  if (gc.isMicrophoneMuted()) return;
  if (getLiveLocalAudioTrack(gc)) return;

  await gc.setMicrophoneMuted(true);
  await gc.setMicrophoneMuted(false);
  await waitForLiveLocalAudioTrack(gc, 400);
}

/**
 * After enter() or participant changes, confirm local tracks are live and retry
 * pairwise call placement so remote peers receive A/V.
 */
async function ensureLocalCallMediaPublished(
  gc: MatrixSdk.GroupCall,
  kind: 'audio' | 'video',
): Promise<void> {
  try {
    if (!gc.isMicrophoneMuted()) {
      await recoverLocalMicrophoneFeed(gc);
    }
    if (kind === 'video' && !gc.isLocalVideoMuted()) {
      await recoverLocalCameraFeed(gc);
    }
  } catch {
    /* keep call connected if device recovery fails */
  }
  nudgeGroupCallPlaceOutgoing(gc);
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
  const {
    authToken = null,
    spaceSlug = null,
    onCallArtifactsUploaded,
    getCallLaunchContext,
  } = options;
  const latestAuthTokenRef = useRef<string | null>(authToken?.trim() || null);
  const latestSpaceSlugRef = useRef<string | null>(spaceSlug?.trim() || null);
  /** Pinned at connect so upload still works if chat panel unbinds mid-call. */
  const pinnedUploadContextRef = useRef<{
    authToken: string;
    spaceSlug: string;
    roomId: string;
  } | null>(null);
  const onCallArtifactsUploadedRef = useRef(onCallArtifactsUploaded);
  const getCallLaunchContextRef = useRef(getCallLaunchContext);

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
  const [screenshareTakeoverIncoming, setScreenshareTakeoverIncoming] =
    useState<ScreenshareTakeoverIncoming | null>(null);
  const [screenshareTakeoverPendingId, setScreenshareTakeoverPendingId] =
    useState<string | null>(null);
  const [screenshareTakeoverDenied, setScreenshareTakeoverDenied] =
    useState(false);
  const screenshareTakeoverPendingIdRef = useRef<string | null>(null);
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
  /** Latest active speaker for transcript attribution (avoids stale closure in SR). */
  const activeSpeakerKeyRef = useRef<string | null>(null);
  /** Screenshare-only failure (does not end the call). */
  const [screenshareErrorCode, setScreenshareErrorCode] =
    useState<SpaceGroupCallErrorCode | null>(null);
  const [recordingStatus, setRecordingStatus] =
    useState<SpaceGroupCallRecordingStatus>('idle');
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingWarning, setRecordingWarning] = useState<{
    code: CallRecordingLimitWarningCode;
    remainingMinutes: number;
    remainingSizeMb: number;
  } | null>(null);
  const [canRetryRecordingUpload, setCanRetryRecordingUpload] = useState(false);
  const [capturePreference, setCapturePreference] = useState<
    Exclude<SpaceGroupCallCaptureMode, 'none'>
  >('recording_with_transcript');
  const [capturePreferenceSelected, setCapturePreferenceSelected] =
    useState(false);
  const [captureMode, setCaptureMode] =
    useState<SpaceGroupCallCaptureMode>('none');
  const [activeRoomCapture, setActiveRoomCapture] =
    useState<SpaceGroupCallCaptureConsent | null>(null);

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
  const localMediaBootstrapDebounceRef = useRef<number | null>(null);
  const localMediaBootstrapTimerRefs = useRef<number[]>([]);
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
  const captureBootstrapInFlightRef = useRef(false);
  const recordingRuntimeRef = useRef<{
    generation: number;
    mode: SpaceGroupCallCaptureMode;
    pauseRecorder?: () => void;
    resumeRecorder?: () => void;
    stopRecorder?: () => Promise<Blob>;
    pauseTranscript?: () => Promise<void> | void;
    resumeTranscript?: () => void;
    stopTranscript: () => Promise<string> | string;
    mimeType?: string;
    hasVideoRecording: boolean;
    startedAt: string;
    recordedRoomId: string;
  } | null>(null);
  const pendingRecordingUploadRef = useRef<PendingRecordingUpload | null>(null);
  const captureModeRef = useRef<SpaceGroupCallCaptureMode>('none');
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

  useEffect(() => {
    latestAuthTokenRef.current = authToken?.trim() || null;
  }, [authToken]);

  useEffect(() => {
    latestSpaceSlugRef.current = spaceSlug?.trim() || null;
  }, [spaceSlug]);

  useEffect(() => {
    const inSession =
      callState === 'connected' ||
      callState === 'awaiting_media' ||
      callState === 'connecting' ||
      callState === 'initializing' ||
      callState === 'disconnecting';
    if (!inSession) return;
    const token = latestAuthTokenRef.current;
    const slug = latestSpaceSlugRef.current;
    const activeRoom = roomId?.trim();
    if (!token || !slug || !activeRoom) return;
    pinnedUploadContextRef.current = {
      authToken: token,
      spaceSlug: slug,
      roomId: activeRoom,
    };
  }, [callState, roomId, spaceSlug, authToken]);

  useEffect(() => {
    onCallArtifactsUploadedRef.current = onCallArtifactsUploaded;
  }, [onCallArtifactsUploaded]);

  useEffect(() => {
    getCallLaunchContextRef.current = getCallLaunchContext;
  }, [getCallLaunchContext]);

  useEffect(() => {
    captureModeRef.current = captureMode;
  }, [captureMode]);

  const setActiveKeyFromGroupCall = useCallback((gc: MatrixSdk.GroupCall) => {
    const f = gc.activeSpeaker;
    const key = f ? `${f.userId}::${f.deviceId ?? ''}` : null;
    activeSpeakerKeyRef.current = key;
    setActiveSpeakerKey(key);
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

  const clearLocalMediaBootstrapTimers = useCallback(() => {
    if (localMediaBootstrapDebounceRef.current != null) {
      clearTimeout(localMediaBootstrapDebounceRef.current);
      localMediaBootstrapDebounceRef.current = null;
    }
    if (localMediaBootstrapTimerRefs.current.length > 0) {
      for (const id of localMediaBootstrapTimerRefs.current) {
        clearTimeout(id);
      }
      localMediaBootstrapTimerRefs.current = [];
    }
  }, []);

  const syncLocalScreenshareState = useCallback(
    (gc: MatrixSdk.GroupCall | null | undefined) => {
      if (!gc) {
        setIsScreensharing(false);
        return;
      }
      setIsScreensharing(gc.isScreensharing());
    },
    [],
  );

  const sendScreenshareTakeoverEvent = useCallback(
    async (
      action: 'request' | 'approve' | 'deny' | 'cancel',
      requestId: string,
      requesterUserId: string,
      targetUserId?: string,
    ) => {
      const activeRoomId = roomId?.trim();
      if (!client || !activeRoomId) return;
      try {
        await client.sendEvent(
          activeRoomId,
          MatrixSdk.EventType.RoomMessage,
          buildScreenshareTakeoverContent(
            action,
            requestId,
            requesterUserId,
            targetUserId,
          ),
        );
      } catch {
        // best effort
      }
    },
    [client, roomId],
  );

  const enableLocalScreenshareDirect = useCallback(
    async (gc: MatrixSdk.GroupCall) => {
      try {
        const ok = await gc.setScreensharingEnabled(true);
        syncLocalScreenshareState(gc);
        if (ok === false) {
          setScreenshareErrorCode('WEBRTC_FAILED');
        }
      } catch (e) {
        syncLocalScreenshareState(gc);
        if (isPermissionLikeGroupCallError(e)) {
          setScreenshareErrorCode('PERMISSION_DENIED');
        } else {
          setScreenshareErrorCode('WEBRTC_FAILED');
        }
      }
      scheduleFeedBatched();
    },
    [scheduleFeedBatched, syncLocalScreenshareState],
  );

  const announceCaptureNotice = useCallback(
    async (
      action: 'started' | 'stopped',
      mode: Exclude<SpaceGroupCallCaptureMode, 'none'>,
    ) => {
      const activeRoomId = roomId?.trim();
      if (!client || !activeRoomId) return;
      const noticeId = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      try {
        const noticePayload = {
          msgtype: MatrixSdk.MsgType.Notice,
          body: CALL_CAPTURE_NOTICE_BODY,
          [CALL_CAPTURE_NOTICE_TYPE]: true,
          notice_id: noticeId,
          action,
          mode,
          sent_at: new Date().toISOString(),
        } as RoomMessageEventContent;
        await client.sendEvent(
          activeRoomId,
          MatrixSdk.EventType.RoomMessage,
          noticePayload,
        );
      } catch {
        // best effort; recording can continue without room-wide notice
      }
    },
    [client, roomId],
  );

  const beginCaptureRuntimeAsync = useCallback(async (): Promise<boolean> => {
    if (recordingRuntimeRef.current) return true;
    if (recordingFinalizeInFlightRef.current) return false;
    if (captureBootstrapInFlightRef.current) return false;

    const mode = captureModeRef.current;
    if (mode === 'none') return false;
    if (!isCaptureEligibleCallState(callState)) return false;

    const sessionId = callSessionId?.trim();
    const activeRoom =
      roomId?.trim() || pinnedUploadContextRef.current?.roomId?.trim() || '';
    if (!sessionId || !activeRoom) return false;

    captureBootstrapInFlightRef.current = true;
    try {
      const gc = groupCallRef.current ?? groupCall;
      let recorder: Awaited<ReturnType<typeof createCallRecording>> | null =
        null;
      if (mode === 'recording_with_transcript') {
        recorder = await createCallRecording(gc);
        if (!recorder) {
          setRecordingStatus('error');
          setRecordingError(
            'Could not access your microphone for recording. Check browser permissions and try again.',
          );
          setCaptureMode('none');
          return false;
        }
      }

      const armedModeAfterRecorder: SpaceGroupCallCaptureMode =
        captureModeRef.current;
      if (armedModeAfterRecorder === 'none') {
        if (recorder) await recorder.stop().catch(() => undefined);
        return false;
      }

      const transcript = startBrowserCallTranscription({
        resolveSpeakerLabel: () =>
          resolveMatrixSpeakerDisplayName(
            client,
            activeRoom,
            activeSpeakerKeyRef.current,
          ),
        onError: () => {
          // recording continues even if speech recognition fails
        },
      });
      if (mode === 'transcript_only' && transcript.supported === false) {
        if (recorder) await recorder.stop().catch(() => undefined);
        setRecordingStatus('error');
        setRecordingError(
          'transcript capture is not supported in this browser',
        );
        setCaptureMode('none');
        return false;
      }

      const armedModeBeforeRuntime: SpaceGroupCallCaptureMode =
        captureModeRef.current;
      if (armedModeBeforeRuntime === 'none') {
        if (recorder) await recorder.stop().catch(() => undefined);
        return false;
      }

      const generation = recordingGenerationRef.current + 1;
      recordingGenerationRef.current = generation;
      recordingRuntimeRef.current = {
        generation,
        mode,
        pauseRecorder: recorder?.pause,
        resumeRecorder: recorder?.resume,
        stopRecorder: recorder?.stop,
        pauseTranscript: transcript.pause,
        resumeTranscript: transcript.resume,
        stopTranscript: transcript.stop,
        mimeType: recorder?.mimeType,
        hasVideoRecording: recorder?.mimeType?.startsWith('video/') ?? false,
        startedAt: new Date().toISOString(),
        recordedRoomId: activeRoom,
      };
      setRecordingStatus('recording');
      setRecordingError(null);
      setRecordingWarning(null);
      void announceCaptureNotice('started', mode);
      if (roomId) {
        logSpaceGroupCallEvent({
          name: 'hypha.group_call.capture_started',
          roomId,
          kind: callKind ?? undefined,
          captureMode: mode,
          hasRecorder: Boolean(recorder),
          hasGroupCall: Boolean(gc),
        });
      }
      return true;
    } finally {
      captureBootstrapInFlightRef.current = false;
    }
  }, [
    announceCaptureNotice,
    callKind,
    callSessionId,
    callState,
    client,
    groupCall,
    roomId,
  ]);

  const waitForCaptureBootstrap = useCallback(async () => {
    let waited = 0;
    while (captureBootstrapInFlightRef.current && waited < 8_000) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 100);
      });
      waited += 100;
    }
  }, []);

  const finalizeRecording = useCallback(() => {
    const runtime = recordingRuntimeRef.current;
    const runtimeGeneration = runtime?.generation ?? null;
    if (
      recordingFinalizeInFlightRef.current &&
      runtimeGeneration != null &&
      recordingFinalizeGenerationRef.current === runtimeGeneration
    ) {
      return;
    }

    const token =
      latestAuthTokenRef.current ??
      pinnedUploadContextRef.current?.authToken ??
      null;
    const slug =
      latestSpaceSlugRef.current ??
      pinnedUploadContextRef.current?.spaceSlug ??
      null;
    const activeRoomId =
      runtime?.recordedRoomId?.trim() ||
      roomId?.trim() ||
      pinnedUploadContextRef.current?.roomId ||
      null;
    if (!runtime) {
      recordingRuntimeRef.current = null;
      if (!recordingFinalizeInFlightRef.current) {
        setRecordingStatus('idle');
      }
      return;
    }
    if (!token || !activeRoomId) {
      recordingRuntimeRef.current = null;
      void (async () => {
        try {
          if (runtime.stopRecorder) {
            await runtime.stopRecorder();
          }
        } catch {
          // ignore recorder stop errors during teardown-only cleanup
        }
        try {
          await runtime.stopTranscript();
        } catch {
          // ignore transcript stop errors during teardown-only cleanup
        }
        if (!recordingFinalizeInFlightRef.current) {
          setRecordingStatus('error');
          setRecordingError(
            !token
              ? 'recording upload skipped: missing auth token'
              : 'recording upload skipped: missing room context',
          );
        }
      })();
      return;
    }
    if (!slug) {
      recordingRuntimeRef.current = null;
      void (async () => {
        try {
          if (runtime.stopRecorder) {
            await runtime.stopRecorder();
          }
        } catch {
          // ignore recorder stop errors during teardown-only cleanup
        }
        try {
          await runtime.stopTranscript();
        } catch {
          // ignore transcript stop errors during teardown-only cleanup
        }
        if (!recordingFinalizeInFlightRef.current) {
          setRecordingStatus('error');
          setRecordingError('recording upload skipped: missing space slug');
        }
      })();
      return;
    }

    const cleanupGeneration = runtime.generation;
    recordingFinalizeInFlightRef.current = true;
    recordingFinalizeGenerationRef.current = cleanupGeneration;
    recordingRuntimeRef.current = null;
    setRecordingStatus('uploading');
    if (
      runtime.mode === 'recording_with_transcript' ||
      runtime.mode === 'transcript_only'
    ) {
      void announceCaptureNotice('stopped', runtime.mode);
    }
    void (async () => {
      let captureFinalizeOk = true;
      const failCaptureFinalize = (
        message: string,
        options?: { blob?: Blob; pending?: PendingRecordingUpload },
      ) => {
        captureFinalizeOk = false;
        if (options?.blob) {
          downloadCallRecordingBackup(
            options.blob,
            options.pending?.callSessionId ?? callSessionId ?? 'recording',
            options.pending?.mimeType ?? runtime.mimeType,
          );
        }
        if (options?.pending) {
          pendingRecordingUploadRef.current = options.pending;
          setCanRetryRecordingUpload(true);
        }
        if (recordingFinalizeGenerationRef.current === cleanupGeneration) {
          setRecordingStatus('error');
          setRecordingError(message);
        }
      };

      try {
        const startedMs = Date.parse(runtime.startedAt);
        if (Number.isFinite(startedMs)) {
          const remaining = CAPTURE_MIN_DURATION_MS - (Date.now() - startedMs);
          if (remaining > 0) {
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, remaining);
            });
          }
        }
        const endedAt = new Date().toISOString();
        const transcriptText = await runtime.stopTranscript();
        const sessionId = callSessionId ?? newCallSessionId();
        const normalizedTranscript = transcriptText.trim();
        const launchContext =
          getCallLaunchContextRef.current?.() ??
          (threadContext?.threadRootEventId
            ? { threadRootEventId: threadContext.threadRootEventId }
            : null);
        const uploadTranscriptOnly = async () => {
          if (!normalizedTranscript) return;
          await uploadRecordedCallArtifact({
            authToken: token,
            spaceSlug: slug,
            roomId: activeRoomId,
            callSessionId: sessionId,
            transcriptText: normalizedTranscript,
            startedAt: runtime.startedAt,
            endedAt,
            launchContext: launchContext ?? undefined,
          });
        };
        const uploadRecordingBlob = async (blob: Blob) => {
          const pendingPayload: PendingRecordingUpload = {
            blob,
            mimeType: runtime.mimeType ?? blob.type ?? 'video/webm',
            callSessionId: sessionId,
            spaceSlug: slug,
            roomId: activeRoomId,
            authToken: token,
            transcriptText: normalizedTranscript || undefined,
            startedAt: runtime.startedAt,
            endedAt,
            launchContext: launchContext ?? undefined,
          };
          try {
            const result = await uploadRecordedCallArtifactWithRetry({
              authToken: token,
              spaceSlug: slug,
              roomId: activeRoomId,
              callSessionId: sessionId,
              blob,
              mimeType: runtime.mimeType,
              transcriptText: normalizedTranscript,
              startedAt: runtime.startedAt,
              endedAt,
              launchContext: launchContext ?? undefined,
            });
            if (!result.recording_stored) {
              failCaptureFinalize(
                'Recording upload did not persist media. A copy was saved to your downloads folder — use Retry upload.',
                { blob, pending: pendingPayload },
              );
              return;
            }
            pendingRecordingUploadRef.current = null;
            setCanRetryRecordingUpload(false);
          } catch (error) {
            const baseMessage =
              error instanceof Error ? error.message : String(error);
            failCaptureFinalize(
              `${baseMessage} A copy was saved to your downloads folder — use Retry upload.`,
              { blob, pending: pendingPayload },
            );
          }
        };
        if (runtime.mode === 'transcript_only') {
          if (normalizedTranscript) {
            await uploadTranscriptOnly();
          } else if (
            recordingFinalizeGenerationRef.current === cleanupGeneration
          ) {
            captureFinalizeOk = false;
            setRecordingStatus('error');
            setRecordingError('No speech was captured during this call.');
          }
        } else if (runtime.mode === 'recording_with_transcript') {
          if (!runtime.stopRecorder || !runtime.mimeType) {
            await uploadTranscriptOnly();
          } else {
            const blob = await runtime.stopRecorder();
            const recordingTooSmall =
              blob.size === 0 || blob.size < CALL_RECORDING_MIN_FILE_SIZE_BYTES;
            if (recordingTooSmall) {
              if (roomId) {
                logSpaceGroupCallEvent({
                  name: 'hypha.group_call.error',
                  roomId,
                  errorCode: 'CAPTURE_EMPTY_BLOB',
                });
              }
              if (normalizedTranscript) {
                await uploadTranscriptOnly();
                if (
                  recordingFinalizeGenerationRef.current === cleanupGeneration
                ) {
                  captureFinalizeOk = false;
                  setRecordingStatus('error');
                  setRecordingError(
                    'Recording file was empty. Transcript only was saved.',
                  );
                }
              } else if (
                recordingFinalizeGenerationRef.current === cleanupGeneration
              ) {
                captureFinalizeOk = false;
                setRecordingStatus('error');
                setRecordingError(
                  'Recording file was empty and no transcript was captured.',
                );
              }
            } else {
              await uploadRecordingBlob(blob);
            }
          }
        }
        if (
          recordingFinalizeGenerationRef.current === cleanupGeneration &&
          captureFinalizeOk
        ) {
          setRecordingStatus('idle');
          setRecordingError(null);
          setRecordingWarning(null);
          onCallArtifactsUploadedRef.current?.({ spaceSlug: slug });
        }
      } catch (error) {
        if (recordingFinalizeGenerationRef.current === cleanupGeneration) {
          captureFinalizeOk = false;
          setRecordingStatus('error');
          setRecordingError(
            error instanceof Error ? error.message : String(error),
          );
        }
      } finally {
        if (recordingFinalizeGenerationRef.current === cleanupGeneration) {
          recordingFinalizeInFlightRef.current = false;
          recordingFinalizeGenerationRef.current = null;
          pinnedUploadContextRef.current = null;
        }
      }
    })();
  }, [announceCaptureNotice, callSessionId, client, roomId]);

  const runCleanupRef = useRef<() => void>(() => {});

  const runCleanup = useCallback(() => {
    const shouldBootstrapCapture =
      captureModeRef.current !== 'none' &&
      !recordingRuntimeRef.current &&
      !recordingFinalizeInFlightRef.current;

    void (async () => {
      if (shouldBootstrapCapture) {
        await beginCaptureRuntimeAsync();
      }
      finalizeRecording();
    })();
    setCaptureMode('none');

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
    clearLocalMediaBootstrapTimers();
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
    activeSpeakerKeyRef.current = null;
    setActiveSpeakerKey(null);
    setCallSessionId(null);
    setScreenshareErrorCode(null);
    setCapturePreferenceSelected(false);
    if (!recordingFinalizeInFlightRef.current) {
      setRecordingStatus('idle');
      setRecordingError(null);
    }
    loggedStatsForGroupCallIdRef.current = null;
    lastRoomIdForTelemetryRef.current = null;
  }, [
    beginCaptureRuntimeAsync,
    clearConnectingStallTimer,
    clearLocalMediaBootstrapTimers,
    clearMediaDebugInterval,
    finalizeRecording,
  ]);

  runCleanupRef.current = runCleanup;

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

  const scheduleLocalMediaBootstrap = useCallback((gc: MatrixSdk.GroupCall) => {
    if (typeof window === 'undefined') return;
    if (localMediaBootstrapDebounceRef.current != null) {
      clearTimeout(localMediaBootstrapDebounceRef.current);
    }
    localMediaBootstrapDebounceRef.current = window.setTimeout(() => {
      localMediaBootstrapDebounceRef.current = null;
      if (groupCallRef.current !== gc) return;
      const kind = lastJoinKindRef.current ?? 'audio';
      void ensureLocalCallMediaPublished(gc, kind);
    }, 350);
  }, []);

  const startLocalMediaBootstrapSeries = useCallback(
    (gc: MatrixSdk.GroupCall) => {
      if (typeof window === 'undefined') return;
      clearLocalMediaBootstrapTimers();
      const kind = lastJoinKindRef.current ?? 'audio';
      localMediaBootstrapTimerRefs.current = LOCAL_MEDIA_BOOTSTRAP_MS.map(
        (delayMs) =>
          window.setTimeout(() => {
            if (groupCallRef.current !== gc) return;
            void ensureLocalCallMediaPublished(gc, kind);
          }, delayMs),
      );
    },
    [clearLocalMediaBootstrapTimers],
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
      scheduleLocalMediaBootstrap(gc);
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
  }, [client, roomId, inCallUserIdsFromGroupCall, scheduleLocalMediaBootstrap]);

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
        const captureActive =
          captureModeRef.current !== 'none' ||
          recordingRuntimeRef.current != null ||
          recordingFinalizeInFlightRef.current;
        if (isJoiningRef.current && !isPermissionLikeGroupCallError(err)) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              '[hypha.group_call] Ignoring transient group call error during join',
              err,
            );
          }
          return;
        }
        if (shouldIgnoreGroupCallErrorDuringCapture(err, captureActive)) {
          if (roomId) {
            logSpaceGroupCallEvent({
              name: 'hypha.group_call.error_ignored',
              roomId,
              kind: lastJoinKindRef.current ?? undefined,
              errorCode: 'WEBRTC_FAILED',
            });
          }
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              '[hypha.group_call] Ignoring transient group call error during capture',
              err,
            );
          }
          return;
        }
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
        abortInFlightJoin(joinEpochRef, isJoiningRef);
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
        const gcNow = groupCallRef.current;
        setIsScreensharing(gcNow ? gcNow.isScreensharing() : sharing);
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
        scheduleLocalMediaBootstrap(gc);
      };
      gc.on(GroupCallEvent.ParticipantsChanged, onParticipantsChanged);
      const onFeedsMaybeParticipants = () => {
        scheduleFeedBatched();
        updateParticipantCount();
        evalRemoteMediaStall();
        syncLocalScreenshareState(gc);
        /** Local/remote feeds can appear after getUserMedia — re-publish and nudge peers. */
        nudgeGroupCallPlaceOutgoing(gc);
        scheduleLocalMediaBootstrap(gc);
      };
      gc.on(GroupCallEvent.UserMediaFeedsChanged, onFeedsMaybeParticipants);
      gc.on(GroupCallEvent.ScreenshareFeedsChanged, onFeedsMaybeParticipants);
      const onActiveSpeaker = (
        feed: { userId: string; deviceId?: string } | undefined,
      ) => {
        const key = feed ? `${feed.userId}::${feed.deviceId ?? ''}` : null;
        activeSpeakerKeyRef.current = key;
        setActiveSpeakerKey(key);
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
      scheduleLocalMediaBootstrap,
      updateParticipantCount,
      evalRemoteMediaStall,
      syncLocalScreenshareState,
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
          // Do not reuse SDK-tracked call after terminate — room state may
          // still carry a different groupCallId ("multiple calls" warning).
          gc = null;
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
        abortInFlightJoin(joinEpochRef, isJoiningRef);
        if (groupCallRef.current !== gc) return;
        if (process.env.NODE_ENV === 'development') {
          console.warn('[hypha.group_call] enter() stalled — forcing cleanup', {
            roomId,
            ms: CONNECT_STALL_ABORT_MS,
          });
        }
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
          abortStaleJoinAttempt(setCallState);
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
        abortInFlightJoin(joinEpochRef, isJoiningRef);
        runCleanup();
        setCallKind(null);
        setThreadContext(null);
        joinStartedAtRef.current = null;
        return;
      }

      clearConnectingStallTimer();

      if (joinEpoch !== joinEpochRef.current || groupCallRef.current !== gc) {
        isJoiningRef.current = false;
        abortStaleJoinAttempt(setCallState);
        return;
      }

      try {
        await applyVoiceProcessingPresetToGroupCall(gc, voiceProcessingPreset);
      } catch {
        // keep the call connected if browser denies advanced audio constraints
      }
      /**
       * Voice preset replaces the local audio stream; confirm mic/camera tracks
       * are live and retry pairwise call placement so remote peers receive A/V.
       */
      try {
        await ensureLocalCallMediaPublished(gc, kind);
      } catch {
        /* best-effort local media bootstrap */
      }

      if (typeof window !== 'undefined') {
        if (placeOutgoingNudgeTimerRef.current != null) {
          clearTimeout(placeOutgoingNudgeTimerRef.current);
        }
        placeOutgoingNudgeTimerRef.current = window.setTimeout(() => {
          placeOutgoingNudgeTimerRef.current = null;
          if (groupCallRef.current !== gc) return;
          void ensureLocalCallMediaPublished(gc, kind);
        }, PLACE_OUTGOING_DELAYED_MS);
        placeOutgoingRetryTimerRefs.current = PLACE_OUTGOING_RETRY_MS.map(
          (delayMs) =>
            window.setTimeout(() => {
              if (groupCallRef.current !== gc) return;
              nudgeGroupCallPlaceOutgoing(gc);
            }, delayMs),
        );
        startLocalMediaBootstrapSeries(gc);
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
      syncLocalScreenshareState(gc);
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
      startLocalMediaBootstrapSeries,
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
    abortInFlightJoin(joinEpochRef, isJoiningRef);
    runCleanup();
    setCallState('idle');
    setErrorCode(null);
    setCallKind(null);
    setIsScreensharing(false);
    setScreenshareTakeoverIncoming(null);
    setScreenshareTakeoverPendingId(null);
    setScreenshareTakeoverDenied(false);
    screenshareTakeoverPendingIdRef.current = null;
    setThreadContext(null);
    setParticipantCount(0);
    setTabBackgroundWhileInCall(false);
  }, [callState, runCleanup]);

  const setMicrophoneMuted = useCallback(
    async (muted: boolean) => {
      const gc = groupCallRef.current;
      if (!gc) return;
      await gc.setMicrophoneMuted(muted);
      if (!muted) {
        nudgeGroupCallPlaceOutgoing(gc);
        if (!(await waitForLiveLocalAudioTrack(gc))) {
          try {
            await recoverLocalMicrophoneFeed(gc);
          } catch {
            /* mic permission / hardware — remain in call with mic off */
          }
        }
        nudgeGroupCallPlaceOutgoing(gc);
      }
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
        if (!(await waitForLiveLocalVideoTrack(gc))) {
          try {
            await recoverLocalCameraFeed(gc);
          } catch {
            /* camera permission / hardware — remain in call with video off */
          }
        }
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

      const sdkSharing = gc.isScreensharing();
      if (enabled === sdkSharing) {
        setIsScreensharing(sdkSharing);
        return;
      }

      if (enabled) {
        const localUserId = client?.getUserId()?.trim() ?? null;
        const remoteOwner = getRemoteScreenshareOwner(gc);
        if (
          remoteOwner &&
          localUserId &&
          remoteOwner.userId !== localUserId &&
          !sdkSharing
        ) {
          const requestId = crypto.randomUUID();
          screenshareTakeoverPendingIdRef.current = requestId;
          setScreenshareTakeoverPendingId(requestId);
          setScreenshareTakeoverDenied(false);
          await sendScreenshareTakeoverEvent(
            'request',
            requestId,
            localUserId,
            remoteOwner.userId,
          );
          return;
        }
        await enableLocalScreenshareDirect(gc);
        return;
      }

      try {
        await gc.setScreensharingEnabled(false);
      } catch {
        // user-initiated stop — reconcile UI even when SDK throws
      }
      syncLocalScreenshareState(gc);
      setScreenshareTakeoverIncoming(null);
      scheduleFeedBatched();
    },
    [
      client,
      enableLocalScreenshareDirect,
      scheduleFeedBatched,
      sendScreenshareTakeoverEvent,
      syncLocalScreenshareState,
    ],
  );

  const approveScreenshareTakeover = useCallback(
    async (request: ScreenshareTakeoverIncoming) => {
      const gc = groupCallRef.current;
      const localUserId = client?.getUserId()?.trim();
      if (!gc || !localUserId || !request.requestId.trim()) return;
      setScreenshareTakeoverIncoming(null);
      try {
        if (gc.isScreensharing()) {
          await gc.setScreensharingEnabled(false);
        }
      } catch {
        // continue — still notify requester
      }
      syncLocalScreenshareState(gc);
      await sendScreenshareTakeoverEvent(
        'approve',
        request.requestId.trim(),
        request.requesterUserId,
        localUserId,
      );
      scheduleFeedBatched();
    },
    [
      client,
      scheduleFeedBatched,
      sendScreenshareTakeoverEvent,
      syncLocalScreenshareState,
    ],
  );

  const denyScreenshareTakeover = useCallback(
    async (request: ScreenshareTakeoverIncoming) => {
      const localUserId = client?.getUserId()?.trim();
      if (!localUserId || !request.requestId.trim()) return;
      setScreenshareTakeoverIncoming(null);
      await sendScreenshareTakeoverEvent(
        'deny',
        request.requestId.trim(),
        request.requesterUserId,
        localUserId,
      );
    },
    [client, sendScreenshareTakeoverEvent],
  );

  const dismissScreenshareTakeoverPrompt = useCallback(() => {
    setScreenshareTakeoverIncoming(null);
    setScreenshareTakeoverPendingId(null);
    setScreenshareTakeoverDenied(false);
    screenshareTakeoverPendingIdRef.current = null;
  }, []);

  const cancelScreenshareTakeoverRequest = useCallback(async () => {
    const localUserId = client?.getUserId()?.trim();
    const requestId = screenshareTakeoverPendingIdRef.current;
    if (!localUserId || !requestId) {
      dismissScreenshareTakeoverPrompt();
      return;
    }
    await sendScreenshareTakeoverEvent('cancel', requestId, localUserId);
    dismissScreenshareTakeoverPrompt();
  }, [client, dismissScreenshareTakeoverPrompt, sendScreenshareTakeoverEvent]);

  const setVoiceProcessingPreset = useCallback(
    async (preset: SpaceGroupCallVoiceProcessingPreset) => {
      setVoiceProcessingPresetState(preset);
      persistVoiceProcessingPreset(preset);
      const gc = groupCallRef.current;
      if (!gc) return;
      try {
        const applied = await applyVoiceProcessingPresetToGroupCall(gc, preset);
        if (applied) {
          if (!gc.isLocalVideoMuted() && !getLiveLocalVideoTrack(gc)) {
            try {
              await recoverLocalCameraFeed(gc);
            } catch {
              /* keep call connected if camera recovery fails */
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
    if (captureMode === 'none') {
      if (!recordingFinalizeInFlightRef.current) {
        setRecordingStatus('idle');
      }
      return;
    }
    void beginCaptureRuntimeAsync();
  }, [
    beginCaptureRuntimeAsync,
    captureMode,
    callState,
    callSessionId,
    feedVersion,
    groupCall,
    roomId,
  ]);

  useEffect(() => {
    if (captureMode === 'none') return;
    if (recordingRuntimeRef.current) return;
    if (recordingFinalizeInFlightRef.current) return;
    if (recordingStatus !== 'idle') return;
    if (callState === 'connecting' || callState === 'initializing') return;
    if (!isCaptureEligibleCallState(callState)) return;

    const sessionId = callSessionId?.trim();
    const activeRoom = roomId?.trim();
    if (!sessionId || !activeRoom) return;

    const timer = window.setTimeout(() => {
      if (captureModeRef.current === 'none') return;
      if (recordingRuntimeRef.current) return;
      if (recordingFinalizeInFlightRef.current) return;
      void beginCaptureRuntimeAsync().then((started) => {
        if (started) return;
        if (captureModeRef.current === 'none') return;
        if (recordingRuntimeRef.current) return;
        setRecordingStatus('error');
        setRecordingError(
          'Call capture could not start. Check microphone permissions, then try again.',
        );
        setCaptureMode('none');
      });
    }, CAPTURE_START_STALL_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    beginCaptureRuntimeAsync,
    callState,
    captureMode,
    callSessionId,
    groupCall,
    recordingStatus,
    roomId,
  ]);

  useEffect(() => {
    if (recordingStatus !== 'recording' && recordingStatus !== 'paused') {
      setRecordingWarning(null);
      return;
    }
    const evaluateLimits = () => {
      const runtime = recordingRuntimeRef.current;
      if (!runtime) return;
      const startedMs = Date.parse(runtime.startedAt);
      if (!Number.isFinite(startedMs)) return;
      const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - startedMs) / 1000),
      );
      const evaluation = evaluateCallRecordingCaptureLimits({
        elapsedSeconds,
        hasVideo: runtime.hasVideoRecording,
      });
      setRecordingWarning(
        evaluation.warningCode
          ? {
              code: evaluation.warningCode,
              remainingMinutes: Math.max(
                1,
                Math.ceil(evaluation.remainingDurationSeconds / 60),
              ),
              remainingSizeMb: Math.max(
                1,
                Math.ceil(evaluation.remainingBytes / (1024 * 1024)),
              ),
            }
          : null,
      );
    };
    evaluateLimits();
    const timer = window.setInterval(evaluateLimits, CAPTURE_LIMIT_CHECK_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [recordingStatus]);

  const retryRecordingUpload = useCallback(async () => {
    const pending = pendingRecordingUploadRef.current;
    if (!pending) return;
    setRecordingStatus('uploading');
    setRecordingError(null);
    try {
      const result = await uploadRecordedCallArtifactWithRetry({
        authToken: pending.authToken,
        spaceSlug: pending.spaceSlug,
        roomId: pending.roomId,
        callSessionId: pending.callSessionId,
        blob: pending.blob,
        mimeType: pending.mimeType,
        transcriptText: pending.transcriptText,
        startedAt: pending.startedAt,
        endedAt: pending.endedAt,
        launchContext: pending.launchContext,
      });
      if (!result.recording_stored) {
        throw new Error('Recording upload did not persist media.');
      }
      pendingRecordingUploadRef.current = null;
      setCanRetryRecordingUpload(false);
      setRecordingStatus('idle');
      setRecordingError(null);
      onCallArtifactsUploadedRef.current?.({ spaceSlug: pending.spaceSlug });
    } catch (error) {
      downloadCallRecordingBackup(
        pending.blob,
        pending.callSessionId,
        pending.mimeType,
      );
      setRecordingStatus('error');
      setRecordingError(
        `${
          error instanceof Error ? error.message : String(error)
        } A copy was saved to your downloads folder — use Retry upload.`,
      );
    }
  }, []);

  const startCapture = useCallback(
    (mode?: Exclude<SpaceGroupCallCaptureMode, 'none'>) => {
      if (recordingFinalizeInFlightRef.current) return;
      const nextMode = mode ?? capturePreference;
      setCapturePreference(nextMode);
      setCapturePreferenceSelected(true);
      setRecordingError(null);
      if (recordingRuntimeRef.current && captureModeRef.current !== 'none') {
        return;
      }
      captureModeRef.current = nextMode;
      setCaptureMode(nextMode);
      const token = latestAuthTokenRef.current;
      const slug = latestSpaceSlugRef.current;
      const activeRoom =
        roomId?.trim() || pinnedUploadContextRef.current?.roomId?.trim() || '';
      if (token && slug && activeRoom) {
        pinnedUploadContextRef.current = {
          authToken: token,
          spaceSlug: slug,
          roomId: activeRoom,
        };
      }
      void beginCaptureRuntimeAsync();
    },
    [beginCaptureRuntimeAsync, capturePreference, roomId],
  );

  const stopCapture = useCallback(() => {
    const pendingMode = captureModeRef.current;
    void (async () => {
      await waitForCaptureBootstrap();
      if (
        !recordingRuntimeRef.current &&
        !recordingFinalizeInFlightRef.current
      ) {
        if (
          pendingMode === 'recording_with_transcript' ||
          pendingMode === 'transcript_only'
        ) {
          await beginCaptureRuntimeAsync();
        }
      }
      if (recordingRuntimeRef.current || recordingFinalizeInFlightRef.current) {
        finalizeRecording();
      } else if (
        pendingMode === 'recording_with_transcript' ||
        pendingMode === 'transcript_only'
      ) {
        setRecordingStatus('error');
        setRecordingError(
          'Capture did not start. Wait until the record indicator turns red, speak for a few seconds, then stop again.',
        );
        void announceCaptureNotice('stopped', pendingMode);
      } else {
        setRecordingStatus('idle');
        setRecordingError(null);
      }
      setCaptureMode('none');
    })();
  }, [
    announceCaptureNotice,
    beginCaptureRuntimeAsync,
    finalizeRecording,
    waitForCaptureBootstrap,
  ]);

  const pauseCapture = useCallback(() => {
    const runtime = recordingRuntimeRef.current;
    if (!runtime) return;
    if (recordingStatus === 'paused' || recordingStatus === 'uploading') return;
    runtime.pauseRecorder?.();
    void Promise.resolve(runtime.pauseTranscript?.()).finally(() => {
      setRecordingStatus('paused');
    });
  }, [recordingStatus]);

  const resumeCapture = useCallback(() => {
    const runtime = recordingRuntimeRef.current;
    if (!runtime) return;
    if (recordingStatus !== 'paused') return;
    runtime.resumeRecorder?.();
    runtime.resumeTranscript?.();
    setRecordingStatus('recording');
  }, [recordingStatus]);

  useEffect(() => {
    if (!client || !roomId?.trim()) {
      setActiveRoomCapture(null);
      return;
    }
    const activeRoomId = roomId.trim();
    const room = client.getRoom(activeRoomId);
    if (!room) {
      setActiveRoomCapture(null);
      return;
    }
    const localUserId = client.getUserId() ?? null;
    const syncFromTimeline = () => {
      const recent = room.getLiveTimeline()?.getEvents()?.slice().reverse();
      if (!recent?.length) {
        setActiveRoomCapture(null);
        return;
      }
      setActiveRoomCapture(
        resolveActiveRoomCaptureFromEvents(
          recent,
          (senderId) => {
            const member = room.getMember(senderId);
            return member
              ? matrixMemberDisplayLabel(member, senderId)
              : senderId;
          },
          localUserId,
        ),
      );
    };

    syncFromTimeline();
    const onTimeline = () => {
      syncFromTimeline();
    };
    room.on(RoomEvent.Timeline, onTimeline);
    return () => {
      room.off(RoomEvent.Timeline, onTimeline);
    };
  }, [client, roomId]);

  useEffect(() => {
    screenshareTakeoverPendingIdRef.current = screenshareTakeoverPendingId;
  }, [screenshareTakeoverPendingId]);

  useEffect(() => {
    if (!client || !roomId?.trim() || callState !== 'connected') {
      setScreenshareTakeoverIncoming(null);
      return;
    }
    const activeRoomId = roomId.trim();
    const room = client.getRoom(activeRoomId);
    const gc = groupCallRef.current;
    if (!room || !gc) return;

    const localUserId = client.getUserId() ?? null;
    const syncTakeoverFromTimeline = () => {
      const recent = room.getLiveTimeline()?.getEvents()?.slice().reverse();
      if (!recent?.length) return;

      const incoming = resolveIncomingScreenshareTakeover(
        recent,
        localUserId,
        gc.isScreensharing(),
        (senderId) => room.getMember(senderId)?.name || senderId,
      );
      setScreenshareTakeoverIncoming(incoming);

      const pendingId = screenshareTakeoverPendingIdRef.current;
      if (pendingId) {
        const outcome = resolveScreenshareTakeoverOutcome(
          recent,
          localUserId,
          pendingId,
        );
        if (outcome === 'approved') {
          screenshareTakeoverPendingIdRef.current = null;
          setScreenshareTakeoverPendingId(null);
          setScreenshareTakeoverDenied(false);
          void enableLocalScreenshareDirect(gc);
        } else if (outcome === 'denied') {
          screenshareTakeoverPendingIdRef.current = null;
          setScreenshareTakeoverPendingId(null);
          setScreenshareTakeoverDenied(true);
        }
      }
    };

    syncTakeoverFromTimeline();
    const onTimeline = () => {
      syncTakeoverFromTimeline();
    };
    room.on(RoomEvent.Timeline, onTimeline);
    return () => {
      room.off(RoomEvent.Timeline, onTimeline);
    };
  }, [
    callState,
    client,
    enableLocalScreenshareDirect,
    feedVersion,
    isScreensharing,
    roomId,
  ]);

  const captureConsent = useMemo(() => {
    const localCapture = resolveLocalCaptureConsent({
      captureMode,
      recordingStatus,
    });
    return resolveCaptureConsent(activeRoomCapture, localCapture);
  }, [activeRoomCapture, captureMode, recordingStatus]);

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
    abortInFlightJoin(joinEpochRef, isJoiningRef);
    runCleanup();
    setCallState('idle');
    setErrorCode(null);
    setCallKind(null);
    setIsScreensharing(false);
    setScreenshareTakeoverIncoming(null);
    setScreenshareTakeoverPendingId(null);
    setScreenshareTakeoverDenied(false);
    screenshareTakeoverPendingIdRef.current = null;
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
      abortInFlightJoin(joinEpochRef, isJoiningRef);
      runCleanupRef.current();
    };
  }, []);

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
    abortInFlightJoin(joinEpochRef, isJoiningRef);
    runCleanup();
    remoteMediaRecoverInFlightRef.current = true;
    setCallState('idle');
    setErrorCode(null);
    setCallKind(null);
    setIsScreensharing(false);
    setScreenshareTakeoverIncoming(null);
    setScreenshareTakeoverPendingId(null);
    setScreenshareTakeoverDenied(false);
    screenshareTakeoverPendingIdRef.current = null;
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

  useEffect(() => {
    if (!recordingRuntimeRef.current) return;
    if (callState === 'idle' || callState === 'error') {
      finalizeRecording();
      setCaptureMode('none');
    }
  }, [callState, finalizeRecording]);

  const dismissCallError = useCallback(() => {
    if (callState !== 'error') return;
    setErrorCode(null);
    setCallState('idle');
    setCallKind(null);
    setThreadContext(null);
    isJoiningRef.current = false;
  }, [callState]);

  const updateCapturePreference = useCallback(
    (mode: Exclude<SpaceGroupCallCaptureMode, 'none'>) => {
      setCapturePreference(mode);
    },
    [],
  );

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

  const showRoomCallInProgressRaw = useMemo(
    () =>
      !inOurSession &&
      idleRoomParticipantCount > 0 &&
      (callState === 'idle' || callState === 'error'),
    [callState, inOurSession, idleRoomParticipantCount],
  );

  /**
   * Hysteresis: show quickly when a call appears, hide only after it stays empty.
   * Prevents join-strip blink + repeated chimes when Matrix sync/token recovery flickers.
   */
  const [showRoomCallInProgress, setShowRoomCallInProgress] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (showRoomCallInProgressRaw) {
      timer = setTimeout(() => setShowRoomCallInProgress(true), 250);
    } else {
      timer = setTimeout(() => setShowRoomCallInProgress(false), 2000);
    }
    return () => {
      if (timer != null) clearTimeout(timer);
    };
  }, [showRoomCallInProgressRaw]);

  return {
    callState,
    callSessionId,
    errorCode,
    screenshareErrorCode,
    recordingStatus,
    recordingError,
    recordingWarning,
    canRetryRecordingUpload,
    retryRecordingUpload,
    captureMode,
    setCaptureMode,
    capturePreference,
    capturePreferenceSelected,
    setCapturePreference: updateCapturePreference,
    startCapture,
    pauseCapture,
    resumeCapture,
    stopCapture,
    captureConsent,
    dismissScreenshareError,
    screenshareTakeoverIncoming,
    screenshareTakeoverPendingId,
    screenshareTakeoverDenied,
    approveScreenshareTakeover,
    denyScreenshareTakeover,
    cancelScreenshareTakeoverRequest,
    dismissScreenshareTakeoverPrompt,
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
