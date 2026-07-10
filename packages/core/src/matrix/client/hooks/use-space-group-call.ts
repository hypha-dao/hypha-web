'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as MatrixSdk from 'matrix-js-sdk';
import { ClientEvent, RoomEvent } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import type { Room as LiveKitRoom } from 'livekit-client';
import { Track } from 'livekit-client';
import {
  MATRIX_RTC_SESSION_EVENT,
  type MatrixRtcSessionLike,
} from './matrix-rtc-events';
import { useMatrix } from '../providers/matrix-provider';
import { matrixMemberDisplayLabel } from '../../matrix-member-display';
import {
  isDeviceNotFoundGroupCallError,
  isDocumentPictureInPictureWindowOpen,
  isPermissionLikeGroupCallError,
  resolveMatrixSpeakerDisplayName,
} from './space-group-call-utils';
import {
  logGroupCallSessionEnd,
  logSpaceGroupCallEvent,
} from './space-group-call-telemetry';
import {
  recordMatrixCallSessionError,
  resetMatrixCallSessionMetrics,
} from './matrix-call-session-metrics';
import { isMatrixCallDebugEnabled } from '../matrix-webrtc-env';
import { ensureCallReactionAnchor } from './call-reactions-client';
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
  resolveIncomingScreenshareTakeover,
  resolveScreenshareTakeoverOutcome,
  type ScreenshareTakeoverIncoming,
} from './screenshare-takeover';
import {
  bindScreenshareStreamStopHandlers,
  clearOrphanedMatrixScreenshareStreams,
  screenshareStreamHasTabAudio,
  screenshareStreamIsBrowserTab,
  withEnhancedScreenshareCapture,
  type CallScreenshareSurfaceMode,
} from './screenshare-capture';
import {
  isLocalCameraPermissionDenied,
  requestLocalCameraAccess,
} from './call-camera-access';
import {
  applyScreenShareCaptureRootRestrictionWithRetry,
  clearScreenShareCaptureRootRestriction,
} from './screenshare-capture-exclusion';
import {
  applyScreenshareTrackContentHints,
  resolveScreenshareVoicePresetPlan,
} from './screenshare-voice-boost';
import {
  clearPersistedPendingRecordingUpload,
  persistPendingRecordingUpload,
  restorePendingRecordingUpload,
} from './call-recording-upload-persistence';
import {
  CALL_MOBILE_VIEWPORT_MAX_PX,
  isCallMobileViewport,
} from './call-mobile-screenshare-policy';
import type { SpaceGroupCallVoiceProcessingPreset } from './voice-processing-constraints';
import {
  resolveLivekitJwtServiceUrl,
  fetchLivekitConnectCredentials,
} from './livekit-jwt';
import {
  activeSpeakerKeyFromRoom,
  attachLiveKitRoomMediaListeners,
  attachLiveKitRtcDebugListeners,
  createLiveKitRoom,
  getRemoteScreenshareOwnerFromRoom,
  isLocalScreenshareActiveInRoom,
  isRemoteScreenshareActiveInRoom,
  localPreviewStreamFromRoom,
  readParticipantsFromLiveKitRoom,
  readParticipantsFromRtcMemberships,
  syncLocalMuteStateFromRoom,
  waitForRtcSessionJoined,
} from './livekit-call-helpers';
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
  | 'DEVICE_NOT_FOUND'
  | 'CONNECT_STALL'
  | 'WEBRTC_FAILED'
  | 'UNKNOWN';

type MatrixClientWithMatrixRtc = MatrixSdk.MatrixClient & {
  matrixRTC: {
    getRoomSession: (room: MatrixSdk.Room) => MatrixRtcSessionLike;
  };
};

function getMatrixRtcSession(
  client: MatrixSdk.MatrixClient,
  matrixRoom: MatrixSdk.Room,
): MatrixRtcSessionLike {
  return (client as MatrixClientWithMatrixRtc).matrixRTC.getRoomSession(
    matrixRoom,
  );
}

function localScreenshareStreamFromLiveKitRoom(
  lkRoom: LiveKitRoom,
): MediaStream | null {
  const pub = lkRoom.localParticipant.getTrackPublication(
    Track.Source.ScreenShare,
  );
  const videoTrack = pub?.track?.mediaStreamTrack;
  if (!videoTrack) return null;
  const tracks: MediaStreamTrack[] = [videoTrack];
  const audioPub = lkRoom.localParticipant.getTrackPublication(
    Track.Source.ScreenShareAudio,
  );
  const audioTrack = audioPub?.track?.mediaStreamTrack;
  if (audioTrack) tracks.push(audioTrack);
  return new MediaStream(tracks);
}

/** Stop local A/V publish without leaving the MatrixRTC session (tab transfer). */
async function stopLiveKitLocalPublishing(lkRoom: LiveKitRoom): Promise<void> {
  const steps: Array<() => unknown> = [
    () => lkRoom.localParticipant.setScreenShareEnabled(false),
    () => lkRoom.localParticipant.setMicrophoneEnabled(false),
    () => lkRoom.localParticipant.setCameraEnabled(false),
  ];
  for (const step of steps) {
    try {
      await Promise.resolve(step());
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          '[hypha.group_call] stopLiveKitLocalPublishing step rejected',
          err,
        );
      }
    }
  }
}

const CAPTURE_START_STALL_MS = 10_000;
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

const ROOM_CALL_PERMISSION_REPAIR_TIMEOUT_MS = 30_000;
/**
 * Debounce for the UI spotlight/focus handoff. LiveKit's `activeSpeakers`
 * ranking flips on raw instantaneous audio level (cross-talk, coughs) far
 * faster than a human would call it a handoff — mirror what real moderators
 * do: a challenger must hold the lead continuously for this long before
 * taking the floor.
 */
const ACTIVE_SPEAKER_MIN_LEAD_MS = 900;
/**
 * The current focused speaker keeps the floor until they've been absent
 * from `activeSpeakers` (i.e. actually gone quiet) for this long — not just
 * briefly outranked while still talking.
 */
const ACTIVE_SPEAKER_SILENCE_GRACE_MS = 600;
const VOICE_PROCESSING_PRESET_KEY = 'hypha-group-call-voice-processing-v1';
const CALL_CAPTURE_NOTICE_BODY = 'Hypha call capture notice';

export type SpaceGroupCallLaunchContext = {
  signalTitle?: string;
  signalSlug?: string;
  threadRootEventId?: string;
  roomTitle?: string;
};

export type SpaceGroupCallOptions = {
  authToken?: string | null;
  spaceSlug?: string | null;
  /** Fired after call recording/transcript artifacts are persisted successfully. */
  onCallArtifactsUploaded?: (params: { spaceSlug: string }) => void;
  /** Optional launch context (signal title, thread root) for Space Memory display. */
  getCallLaunchContext?: () => SpaceGroupCallLaunchContext | null;
};
export type { SpaceGroupCallVoiceProcessingPreset } from './voice-processing-constraints';

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
  const isScreensharingRef = useRef(false);
  isScreensharingRef.current = isScreensharing;
  const screenshareMutationRef = useRef<Promise<void>>(Promise.resolve());
  const screenshareStopHandlersCleanupRef = useRef<(() => void) | null>(null);
  const screenshareSurfaceModeRef =
    useRef<CallScreenshareSurfaceMode>('browser');
  const setScreensharingEnabledRef = useRef<
    (enabled: boolean) => Promise<void>
  >(async () => undefined);
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
  const voiceProcessingPresetRef =
    useRef<SpaceGroupCallVoiceProcessingPreset>('standard');
  const voicePresetRestoreAfterScreenshareRef =
    useRef<SpaceGroupCallVoiceProcessingPreset | null>(null);
  const [presenterVoiceBoostActive, setPresenterVoiceBoostActive] =
    useState(false);
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false);
  const [isLocalVideoMuted, setIsLocalVideoMuted] = useState(true);
  /** Active LiveKit room for UI (tiles); cleared on leave. */
  const [room, setRoom] = useState<LiveKitRoom | null>(null);
  /** Bumps when LiveKit tracks / participants change (re-render stage). */
  const [feedVersion, setFeedVersion] = useState(0);
  /** Active speaker identity from LiveKit; optional UI highlight. */
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [callSessionAnchorEventId, setCallSessionAnchorEventId] = useState<
    string | null
  >(null);
  /** Debounced spotlight/focus key — see `syncActiveSpeakerFromRoom`. */
  const [activeSpeakerKey, setActiveSpeakerKey] = useState<string | null>(null);
  /** Latest debounced spotlight key (avoids stale closure); mirrors `activeSpeakerKey`. */
  const activeSpeakerKeyRef = useRef<string | null>(null);
  /** Raw, undebounced instantaneous top speaker — used for transcript attribution, where accuracy matters more than UI stability. */
  const rawActiveSpeakerKeyRef = useRef<string | null>(null);
  const activeSpeakerCandidateKeyRef = useRef<string | null>(null);
  const activeSpeakerCandidateSinceRef = useRef<number | null>(null);
  const activeSpeakerFocusedSilentSinceRef = useRef<number | null>(null);
  const activeSpeakerCommitTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  /** Screenshare-only failure (does not end the call). */
  const [screenshareErrorCode, setScreenshareErrorCode] =
    useState<SpaceGroupCallErrorCode | null>(null);
  const [screenshareTabAudioMissing, setScreenshareTabAudioMissing] =
    useState(false);
  const [cameraAccessBlocked, setCameraAccessBlocked] = useState(false);
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

  const liveKitRoomRef = useRef<LiveKitRoom | null>(null);
  const rtcSessionRef = useRef<MatrixRtcSessionLike | null>(null);
  /**
   * Tracks async LiveKit disconnect + MatrixRTC leave so a fast re-enter can await
   * teardown and avoid racing the SDK.
   */
  const leaveInFlightRef = useRef<Promise<void> | null>(null);
  const isJoiningRef = useRef(false);
  /** Batches rapid track events into one React update per frame. */
  const feedUpdateRafRef = useRef<number | null>(null);
  const lastJoinKindRef = useRef<'audio' | 'video' | null>(null);
  const lastThreadRootEventIdRef = useRef<string | undefined>(undefined);
  const joinStartedAtRef = useRef<number | null>(null);
  const callSessionStartedAtRef = useRef<number | null>(null);
  const lastRoomIdForTelemetryRef = useRef<string | null>(null);
  const activeCallRoomIdRef = useRef<string | null>(null);
  const liveKitListenerCleanupRef = useRef<(() => void) | null>(null);
  /**
   * Bumped when starting a join — stale async join must not run success paths
   * after forced cleanup.
   */
  const joinEpochRef = useRef(0);
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
  const [isCallRecovering, setIsCallRecovering] = useState(false);
  const [remoteMediaStall] = useState(false);
  const [remoteMediaWarming] = useState(false);
  const [turnServerUnavailable] = useState(false);

  const retryRemoteMediaConnection = useCallback(() => {
    /* SFU path: remote media recovery is handled by LiveKit reconnect. */
  }, []);

  const dismissRemoteMediaStallBanner = useCallback(() => {
    /* no-op — stall banners disabled for LiveKit SFU */
  }, []);

  const dismissTurnServerUnavailableBanner = useCallback(() => {
    /* no-op — TURN probe removed from join path */
  }, []);

  const [tabBackgroundWhileInCall, setTabBackgroundWhileInCall] =
    useState(false);
  /**
   * When local user is not in a call, counts participants from MatrixRTC
   * memberships so the UI can show “call in progress” and a Join affordance.
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

  useEffect(() => {
    const restored = restorePendingRecordingUpload();
    if (!restored) return;
    pendingRecordingUploadRef.current = restored;
    setCanRetryRecordingUpload(true);
    setRecordingStatus('error');
    setRecordingError(
      'Recording upload did not complete. Use Retry upload to send it again.',
    );
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (callState !== 'connected') return;
    const mediaQuery = window.matchMedia(
      `(max-width: ${CALL_MOBILE_VIEWPORT_MAX_PX}px)`,
    );
    const stopShareOnMobile = () => {
      const sharing =
        isScreensharingRef.current ||
        isLocalScreenshareActiveInRoom(liveKitRoomRef.current);
      if (!sharing || !isCallMobileViewport()) return;
      void setScreensharingEnabledRef.current(false);
    };
    stopShareOnMobile();
    mediaQuery.addEventListener('change', stopShareOnMobile);
    return () => mediaQuery.removeEventListener('change', stopShareOnMobile);
  }, [callState]);

  const clearActiveSpeakerCommitTimer = useCallback(() => {
    if (activeSpeakerCommitTimerRef.current != null) {
      clearTimeout(activeSpeakerCommitTimerRef.current);
      activeSpeakerCommitTimerRef.current = null;
    }
  }, []);

  const commitActiveSpeakerFocus = useCallback((key: string | null) => {
    clearActiveSpeakerCommitTimer();
    activeSpeakerCandidateKeyRef.current = null;
    activeSpeakerCandidateSinceRef.current = null;
    activeSpeakerFocusedSilentSinceRef.current = null;
    activeSpeakerKeyRef.current = key;
    setActiveSpeakerKey(key);
  }, []);

  /**
   * Debounced handoff for the UI spotlight. Two rules, mirroring what a
   * human moderator would do: a challenger must hold the lead for
   * `ACTIVE_SPEAKER_MIN_LEAD_MS` before taking over, and the current
   * speaker keeps the floor until they've actually gone quiet (absent from
   * `activeSpeakers`) for `ACTIVE_SPEAKER_SILENCE_GRACE_MS` — not just
   * briefly outranked while still talking. Re-evaluated both on every
   * `ActiveSpeakersChanged` event and via a scheduled timer, so a sustained
   * lead still commits even if the event stream goes briefly quiet.
   */
  const syncActiveSpeakerFromRoom = useCallback(
    (lkRoom: LiveKitRoom) => {
      const speakers = lkRoom.activeSpeakers;
      const topKey = activeSpeakerKeyFromRoom(lkRoom);
      rawActiveSpeakerKeyRef.current = topKey;

      const focusedKey = activeSpeakerKeyRef.current;
      if (topKey === focusedKey) {
        clearActiveSpeakerCommitTimer();
        activeSpeakerCandidateKeyRef.current = null;
        activeSpeakerCandidateSinceRef.current = null;
        activeSpeakerFocusedSilentSinceRef.current = null;
        return;
      }

      if (focusedKey == null) {
        // No current focus yet (first speaker of the call) — adopt immediately.
        commitActiveSpeakerFocus(topKey);
        return;
      }

      const focusedStillPresent = speakers.some(
        (p) => (p.identity?.trim() || null) === focusedKey,
      );
      activeSpeakerFocusedSilentSinceRef.current = focusedStillPresent
        ? null
        : activeSpeakerFocusedSilentSinceRef.current ?? Date.now();

      if (topKey !== activeSpeakerCandidateKeyRef.current) {
        activeSpeakerCandidateKeyRef.current = topKey;
        activeSpeakerCandidateSinceRef.current = Date.now();
        clearActiveSpeakerCommitTimer();
        // No scheduled re-check when the room goes quiet (topKey === null):
        // the spotlight should stay on the last speaker through silence,
        // not fall back to "nobody," until an actual new speaker emerges.
        if (topKey != null) {
          activeSpeakerCommitTimerRef.current = setTimeout(() => {
            activeSpeakerCommitTimerRef.current = null;
            const current = liveKitRoomRef.current;
            if (current) syncActiveSpeakerFromRoom(current);
          }, ACTIVE_SPEAKER_MIN_LEAD_MS);
        }
      }

      const candidateSince = activeSpeakerCandidateSinceRef.current;
      const candidateSustained =
        candidateSince != null &&
        Date.now() - candidateSince >= ACTIVE_SPEAKER_MIN_LEAD_MS;
      const silentSince = activeSpeakerFocusedSilentSinceRef.current;
      const currentReleased =
        silentSince != null &&
        Date.now() - silentSince >= ACTIVE_SPEAKER_SILENCE_GRACE_MS;

      if (candidateSustained && currentReleased) {
        commitActiveSpeakerFocus(topKey);
      }
    },
    [clearActiveSpeakerCommitTimer, commitActiveSpeakerFocus],
  );

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

  const syncLocalScreenshareState = useCallback(
    (lkRoom: LiveKitRoom | null | undefined) => {
      if (!lkRoom) {
        setIsScreensharing(false);
        return;
      }
      setIsScreensharing(isLocalScreenshareActiveInRoom(lkRoom));
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
      const lkRoom = liveKitRoomRef.current ?? room;
      let recorder: Awaited<ReturnType<typeof createCallRecording>> | null =
        null;
      if (mode === 'recording_with_transcript') {
        recorder = await createCallRecording(
          () => liveKitRoomRef.current ?? room,
        );
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
            rawActiveSpeakerKeyRef.current,
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
          hasGroupCall: Boolean(lkRoom),
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
    room,
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
          persistPendingRecordingUpload(options.pending);
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
            clearPersistedPendingRecordingUpload();
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

  const emitCallSessionEnd = useCallback(
    (reason: 'user' | 'error' | 'room' | 'unmount') => {
      const telemetryRoomId = lastRoomIdForTelemetryRef.current;
      if (!telemetryRoomId) return;
      logGroupCallSessionEnd({
        roomId: telemetryRoomId,
        kind: lastJoinKindRef.current ?? undefined,
        reason,
        startedAtMs: callSessionStartedAtRef.current,
      });
      callSessionStartedAtRef.current = null;
    },
    [],
  );

  const runCleanup = useCallback(
    (options?: { skipGroupCallLeave?: boolean }) => {
      joinEpochRef.current += 1;
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

      liveKitListenerCleanupRef.current?.();
      liveKitListenerCleanupRef.current = null;
      setIsCallRecovering(false);
      if (feedUpdateRafRef.current != null) {
        cancelAnimationFrame(feedUpdateRafRef.current);
        feedUpdateRafRef.current = null;
      }
      screenshareStopHandlersCleanupRef.current?.();
      screenshareStopHandlersCleanupRef.current = null;

      const lkRoom = liveKitRoomRef.current;
      const session = rtcSessionRef.current;
      if (lkRoom) {
        if (!options?.skipGroupCallLeave) {
          const p = (async () => {
            try {
              await lkRoom.disconnect();
            } catch (err) {
              if (process.env.NODE_ENV === 'development') {
                console.debug(
                  '[hypha.group_call] LiveKit Room.disconnect() rejected',
                  err,
                );
              }
            }
            try {
              await session?.leaveRoomSession(5000);
            } catch (err) {
              if (process.env.NODE_ENV === 'development') {
                console.debug(
                  '[hypha.group_call] MatrixRTC leaveRoomSession rejected',
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
        } else {
          void stopLiveKitLocalPublishing(lkRoom);
        }
        liveKitRoomRef.current = null;
      } else if (session && !options?.skipGroupCallLeave) {
        void session.leaveRoomSession(5000).catch(() => undefined);
      }
      rtcSessionRef.current = null;

      activeCallRoomIdRef.current = null;
      isJoiningRef.current = false;
      setLocalPreviewStream(null);
      setIsMicrophoneMuted(false);
      setIsLocalVideoMuted(true);
      setRoom(null);
      if (activeSpeakerCommitTimerRef.current != null) {
        clearTimeout(activeSpeakerCommitTimerRef.current);
        activeSpeakerCommitTimerRef.current = null;
      }
      activeSpeakerCandidateKeyRef.current = null;
      activeSpeakerCandidateSinceRef.current = null;
      activeSpeakerFocusedSilentSinceRef.current = null;
      rawActiveSpeakerKeyRef.current = null;
      activeSpeakerKeyRef.current = null;
      setActiveSpeakerKey(null);
      setCallSessionId(null);
      setCallSessionAnchorEventId(null);
      setScreenshareErrorCode(null);
      setCameraAccessBlocked(false);
      setCapturePreferenceSelected(false);
      if (!recordingFinalizeInFlightRef.current) {
        setRecordingStatus('idle');
        setRecordingError(null);
      }
      lastRoomIdForTelemetryRef.current = null;
    },
    [beginCaptureRuntimeAsync, finalizeRecording],
  );

  runCleanupRef.current = runCleanup;

  const refreshLocalPreview = useCallback(() => {
    const lkRoom = liveKitRoomRef.current;
    if (!lkRoom) {
      setLocalPreviewStream(null);
      return;
    }
    setLocalPreviewStream(localPreviewStreamFromRoom(lkRoom));
  }, []);

  const applyPresenterVoiceBoostForScreenshare = useCallback(
    async (lkRoom: LiveKitRoom) => {
      const plan = resolveScreenshareVoicePresetPlan(
        voiceProcessingPresetRef.current,
      );
      voicePresetRestoreAfterScreenshareRef.current = plan.restorePreset;
      setPresenterVoiceBoostActive(plan.restorePreset !== null);
      if (plan.effectivePreset !== voiceProcessingPresetRef.current) {
        setVoiceProcessingPresetState(plan.effectivePreset);
        voiceProcessingPresetRef.current = plan.effectivePreset;
      }
      const micPub = lkRoom.localParticipant.getTrackPublication(
        Track.Source.Microphone,
      );
      applyScreenshareTrackContentHints({
        micTrack: micPub?.track?.mediaStreamTrack,
        screenshareStream: localScreenshareStreamFromLiveKitRoom(lkRoom),
      });
      scheduleFeedBatched();
      refreshLocalPreview();
    },
    [refreshLocalPreview, scheduleFeedBatched],
  );

  const enableLocalScreenshareDirect = useCallback(
    async (lkRoom: LiveKitRoom) => {
      try {
        clearOrphanedMatrixScreenshareStreams(client);
        try {
          await withEnhancedScreenshareCapture(
            client,
            () => lkRoom.localParticipant.setScreenShareEnabled(true),
            screenshareSurfaceModeRef.current,
          );
        } catch (e) {
          clearOrphanedMatrixScreenshareStreams(client);
          syncLocalScreenshareState(lkRoom);
          setScreenshareTabAudioMissing(false);
          if (isPermissionLikeGroupCallError(e)) {
            setScreenshareErrorCode('PERMISSION_DENIED');
          } else {
            setScreenshareErrorCode('WEBRTC_FAILED');
          }
          scheduleFeedBatched();
          return;
        }
        syncLocalScreenshareState(lkRoom);
        const shareStream = localScreenshareStreamFromLiveKitRoom(lkRoom);
        setScreenshareTabAudioMissing(
          screenshareStreamIsBrowserTab(shareStream) &&
            !screenshareStreamHasTabAudio(shareStream),
        );
        await applyPresenterVoiceBoostForScreenshare(lkRoom);
        void applyScreenShareCaptureRootRestrictionWithRetry(shareStream);
        screenshareStopHandlersCleanupRef.current?.();
        screenshareStopHandlersCleanupRef.current =
          bindScreenshareStreamStopHandlers(shareStream, () => {
            void setScreensharingEnabledRef.current(false);
          });
      } catch (e) {
        clearOrphanedMatrixScreenshareStreams(client);
        syncLocalScreenshareState(lkRoom);
        setScreenshareTabAudioMissing(false);
        if (isPermissionLikeGroupCallError(e)) {
          setScreenshareErrorCode('PERMISSION_DENIED');
        } else {
          setScreenshareErrorCode('WEBRTC_FAILED');
        }
      }
      scheduleFeedBatched();
    },
    [
      client,
      scheduleFeedBatched,
      syncLocalScreenshareState,
      applyPresenterVoiceBoostForScreenshare,
    ],
  );

  const restorePresenterVoiceAfterScreenshare = useCallback(
    async (_lkRoom: LiveKitRoom) => {
      const restore = voicePresetRestoreAfterScreenshareRef.current;
      voicePresetRestoreAfterScreenshareRef.current = null;
      setPresenterVoiceBoostActive(false);
      if (restore) {
        setVoiceProcessingPresetState(restore);
        persistVoiceProcessingPreset(restore);
        voiceProcessingPresetRef.current = restore;
      }
      scheduleFeedBatched();
      refreshLocalPreview();
    },
    [refreshLocalPreview, scheduleFeedBatched],
  );

  const reconcileLocalScreenshareStop = useCallback(
    async (
      lkRoom: LiveKitRoom | null | undefined,
      stream?: MediaStream | null,
    ) => {
      screenshareStopHandlersCleanupRef.current?.();
      screenshareStopHandlersCleanupRef.current = null;

      const streamToClear =
        stream ??
        (lkRoom ? localScreenshareStreamFromLiveKitRoom(lkRoom) : null);
      try {
        await clearScreenShareCaptureRootRestriction(streamToClear);
      } catch {
        // track may already be stopped
      }

      if (lkRoom && isLocalScreenshareActiveInRoom(lkRoom)) {
        try {
          await lkRoom.localParticipant.setScreenShareEnabled(false);
        } catch {
          // user-initiated or browser stop — reconcile UI anyway
        }
      }

      clearOrphanedMatrixScreenshareStreams(client);

      if (lkRoom) {
        syncLocalScreenshareState(lkRoom);
        await restorePresenterVoiceAfterScreenshare(lkRoom);
      } else {
        setIsScreensharing(false);
      }
      setScreenshareTabAudioMissing(false);
      setScreenshareTakeoverIncoming(null);
      scheduleFeedBatched();
    },
    [
      client,
      restorePresenterVoiceAfterScreenshare,
      scheduleFeedBatched,
      syncLocalScreenshareState,
    ],
  );

  const updateParticipantCount = useCallback(() => {
    const lkRoom = liveKitRoomRef.current;
    if (!lkRoom) {
      setParticipantCount(0);
      return;
    }
    setParticipantCount(readParticipantsFromLiveKitRoom(lkRoom).count);
  }, []);

  const inCallUserIdsFromLiveKitRoom = useCallback(
    (lkRoom: LiveKitRoom | null) => {
      if (!lkRoom) return [];
      return readParticipantsFromLiveKitRoom(lkRoom).inCallUserIds;
    },
    [],
  );

  const syncLocalMuteState = useCallback((lkRoom: LiveKitRoom) => {
    const state = syncLocalMuteStateFromRoom(lkRoom.localParticipant);
    setIsMicrophoneMuted(state.micMuted);
    setIsLocalVideoMuted(state.cameraMuted);
    setIsScreensharing(state.screensharing);
  }, []);

  const attachLiveKitListeners = useCallback(
    (lkRoom: LiveKitRoom) => {
      liveKitListenerCleanupRef.current?.();
      liveKitListenerCleanupRef.current = null;

      const onMediaChanged = () => {
        const current = liveKitRoomRef.current;
        if (!current) return;
        syncLocalMuteState(current);
        syncLocalScreenshareState(current);
        updateParticipantCount();
        refreshLocalPreview();
        scheduleFeedBatched();
      };

      const onActiveSpeakersChanged = () => {
        const current = liveKitRoomRef.current;
        if (!current) return;
        syncActiveSpeakerFromRoom(current);
      };

      const onDisconnected = () => {
        if (liveKitRoomRef.current !== lkRoom) return;
        if (isJoiningRef.current) return;
        const captureActive =
          captureModeRef.current !== 'none' ||
          recordingRuntimeRef.current != null ||
          recordingFinalizeInFlightRef.current;
        if (captureActive) return;
        setErrorCode('WEBRTC_FAILED');
        setCallState('error');
        recordMatrixCallSessionError('WEBRTC_FAILED');
        if (callSessionStartedAtRef.current) {
          emitCallSessionEnd('error');
        }
        runCleanup();
        setCallKind(null);
        setThreadContext(null);
      };

      liveKitListenerCleanupRef.current = attachLiveKitRoomMediaListeners(
        lkRoom,
        {
          onMediaChanged,
          onActiveSpeakersChanged,
          onDisconnected,
          onReconnected: () => {
            onMediaChanged();
          },
        },
      );
      syncActiveSpeakerFromRoom(lkRoom);
      syncLocalMuteState(lkRoom);
    },
    [
      emitCallSessionEnd,
      refreshLocalPreview,
      runCleanup,
      scheduleFeedBatched,
      syncActiveSpeakerFromRoom,
      syncLocalMuteState,
      syncLocalScreenshareState,
      updateParticipantCount,
    ],
  );

  const enterWithKind = useCallback(
    async (
      kind: 'audio' | 'video',
      threadRootEventId?: string,
      _options?: { preserveRemoteMediaRecoverInFlight?: boolean },
    ) => {
      if (!client || !roomId?.trim()) {
        setErrorCode(!client ? 'NO_CLIENT' : 'NO_ROOM');
        setCallState('error');
        return;
      }
      if (isJoiningRef.current) return;
      if (liveKitRoomRef.current) return;

      if (leaveInFlightRef.current) {
        try {
          await leaveInFlightRef.current;
        } catch {
          // leave rejection already logged in runCleanup
        }
      }

      setIdleRoomParticipantCount(0);
      setIdleInCallUserIds([]);

      joinEpochRef.current += 1;
      const joinEpoch = joinEpochRef.current;

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

      const activeRoomId = roomId.trim();
      const matrixRoom = client.getRoom(activeRoomId);
      if (!matrixRoom) {
        setErrorCode('NOT_READY');
        setCallState('error');
        setCallKind(null);
        setThreadContext(null);
        setCallSessionId(null);
        isJoiningRef.current = false;
        joinStartedAtRef.current = null;
        return;
      }

      let enableCamera = kind === 'video';
      if (kind === 'video') {
        if (await isLocalCameraPermissionDenied()) {
          setCameraAccessBlocked(true);
          enableCamera = false;
        } else {
          setCameraAccessBlocked(false);
        }
      }

      setCallState('connecting');

      if (client && activeRoomId && newSessionId) {
        void (async () => {
          try {
            const anchorEventId = await ensureCallReactionAnchor({
              client,
              roomId: activeRoomId,
              groupCallId: newSessionId,
            });
            if (joinEpoch !== joinEpochRef.current) return;
            if (anchorEventId) {
              setCallSessionAnchorEventId(anchorEventId);
            }
          } catch {
            /* reactions unavailable if anchor publish fails */
          }
        })();
      }

      const debugElapsedMs = () =>
        joinStartedAtRef.current != null
          ? Math.round(
              (typeof performance !== 'undefined'
                ? performance.now()
                : Date.now()) - joinStartedAtRef.current,
            )
          : undefined;
      const logJoinDebugStep = (
        step: string,
        extra?: Record<string, unknown>,
      ) => {
        if (!isMatrixCallDebugEnabled()) return;
        console.info('[hypha.group_call.debug] ' + step, {
          roomId,
          kind,
          elapsedMs: debugElapsedMs(),
          ...extra,
        });
      };

      try {
        const session = getMatrixRtcSession(client, matrixRoom);
        rtcSessionRef.current = session;
        logJoinDebugStep('join-step:session-created');
        const jwtServiceUrl = await resolveLivekitJwtServiceUrl(client);
        logJoinDebugStep('join-step:jwt-service-url-resolved');
        await session.joinRoomSession(
          [{ type: 'livekit', livekit_service_url: jwtServiceUrl }],
          undefined,
          { manageMediaKeys: false, callIntent: kind },
        );
        logJoinDebugStep('join-step:matrix-rtc-join-room-session-sent');
        await waitForRtcSessionJoined(session);
        logJoinDebugStep('join-step:matrix-rtc-session-joined');
        const { url, jwt } = await fetchLivekitConnectCredentials(
          client,
          activeRoomId,
          jwtServiceUrl,
        );
        logJoinDebugStep('join-step:livekit-credentials-fetched');
        const lkRoom = createLiveKitRoom();
        const detachRtcDebugListeners = attachLiveKitRtcDebugListeners(lkRoom, {
          roomId,
          kind,
        });
        logJoinDebugStep('join-step:livekit-connect-start');
        try {
          await lkRoom.connect(url, jwt);
        } catch (connectError) {
          logJoinDebugStep('join-step:livekit-connect-threw', {
            error:
              connectError instanceof Error
                ? { name: connectError.name, message: connectError.message }
                : String(connectError),
          });
          detachRtcDebugListeners();
          throw connectError;
        }
        logJoinDebugStep('join-step:livekit-connect-resolved', {
          remoteParticipantsAtConnect: lkRoom.remoteParticipants.size,
        });

        if (joinEpoch !== joinEpochRef.current) {
          await lkRoom.disconnect().catch(() => undefined);
          await session.leaveRoomSession(5000).catch(() => undefined);
          isJoiningRef.current = false;
          abortStaleJoinAttempt(setCallState);
          return;
        }

        // Enable concurrently (not sequentially) so livekit-client's internal
        // negotiation queue can coalesce both track publishes into a single
        // offer/answer round instead of two separate renegotiations racing
        // the initial ICE gathering — see join-step:livekit-connect-* debug
        // logs for the renegotiation churn this was suspected to cause.
        logJoinDebugStep('join-step:enabling-microphone-and-camera', {
          enableCamera,
        });
        await Promise.all([
          lkRoom.localParticipant.setMicrophoneEnabled(true),
          lkRoom.localParticipant.setCameraEnabled(enableCamera),
        ]);
        logJoinDebugStep('join-step:local-tracks-published');

        liveKitRoomRef.current = lkRoom;
        activeCallRoomIdRef.current = activeRoomId;
        setRoom(lkRoom);
        attachLiveKitListeners(lkRoom);
        updateParticipantCount();
        syncLocalMuteState(lkRoom);
        refreshLocalPreview();

        setCallState('connected');
        resetMatrixCallSessionMetrics();
        callSessionStartedAtRef.current = Date.now();
        isJoiningRef.current = false;
        lastRoomIdForTelemetryRef.current = roomId;

        if (roomId) {
          logSpaceGroupCallEvent({
            name: 'hypha.group_call.connected',
            roomId,
            kind,
            groupCallId: newSessionId,
          });
        }

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
      } catch (e) {
        if (joinEpoch !== joinEpochRef.current) {
          isJoiningRef.current = false;
          abortStaleJoinAttempt(setCallState);
          return;
        }
        isJoiningRef.current = false;
        const permissionLike = isPermissionLikeGroupCallError(e);
        const code: SpaceGroupCallErrorCode = permissionLike
          ? 'PERMISSION_DENIED'
          : isDeviceNotFoundGroupCallError(e)
          ? 'DEVICE_NOT_FOUND'
          : 'WEBRTC_FAILED';
        if (isMatrixCallDebugEnabled()) {
          // The mapped errorCode above collapses everything else to
          // WEBRTC_FAILED; log the raw error so we can see what actually
          // rejected (e.g. connect() timeout vs. a specific DOMException).
          console.error(
            '[hypha.group_call.debug] join-step:enter-with-kind-failed',
            {
              roomId,
              kind,
              code,
              elapsedMs: debugElapsedMs(),
              error:
                e instanceof Error
                  ? { name: e.name, message: e.message, stack: e.stack }
                  : String(e),
            },
          );
        }
        setErrorCode(code);
        setCallSessionId(null);
        if (roomId) {
          logSpaceGroupCallEvent({
            name: 'hypha.group_call.error',
            roomId,
            kind,
            errorCode: code,
          });
        }
        recordMatrixCallSessionError(code);
        emitCallSessionEnd('error');
        setCallState('error');
        runCleanup();
        setCallKind(null);
        setThreadContext(null);
        joinStartedAtRef.current = null;
      }
    },
    [
      attachLiveKitListeners,
      authToken,
      client,
      spaceSlug,
      roomId,
      refreshLocalPreview,
      runCleanup,
      syncLocalMuteState,
      updateParticipantCount,
      emitCallSessionEnd,
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

  const resetAfterLeave = useCallback(() => {
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
    setPresenterVoiceBoostActive(false);
    voicePresetRestoreAfterScreenshareRef.current = null;
  }, [runCleanup]);

  const restoreVoiceBeforeLeaveIfNeeded = useCallback(
    async (lkRoom: LiveKitRoom) => {
      if (
        voicePresetRestoreAfterScreenshareRef.current == null &&
        !isScreensharingRef.current
      ) {
        setPresenterVoiceBoostActive(false);
        return;
      }
      try {
        await Promise.race([
          restorePresenterVoiceAfterScreenshare(lkRoom),
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, 2_000);
          }),
        ]);
      } catch {
        // Never block leave on voice preset restore.
      }
    },
    [restorePresenterVoiceAfterScreenshare],
  );

  const leave = useCallback(async () => {
    if (callState === 'idle') return;
    if (callState === 'disconnecting') {
      const lkRoom = liveKitRoomRef.current;
      if (lkRoom) {
        void restoreVoiceBeforeLeaveIfNeeded(lkRoom);
      }
      resetAfterLeave();
      return;
    }
    setCallState('disconnecting');
    const lkBeforeLeave = liveKitRoomRef.current;
    if (lkBeforeLeave) {
      await restoreVoiceBeforeLeaveIfNeeded(lkBeforeLeave);
    } else {
      setPresenterVoiceBoostActive(false);
      voicePresetRestoreAfterScreenshareRef.current = null;
    }
    if (lastRoomIdForTelemetryRef.current) {
      emitCallSessionEnd('user');
      logSpaceGroupCallEvent({
        name: 'hypha.group_call.left',
        roomId: lastRoomIdForTelemetryRef.current,
        kind: lastJoinKindRef.current ?? undefined,
        reason: 'user',
      });
    }
    resetAfterLeave();
  }, [
    callState,
    emitCallSessionEnd,
    resetAfterLeave,
    restoreVoiceBeforeLeaveIfNeeded,
  ]);

  /**
   * Drop local LiveKit/UI when Matrix sync moves to another tab without leaving
   * the MatrixRTC session — the new leader tab re-enters via resume snapshot.
   */
  const releaseLocalCallForTabTransfer = useCallback(async () => {
    if (callState === 'idle') return;
    setCallState('disconnecting');
    abortInFlightJoin(joinEpochRef, isJoiningRef);
    const lkRoom = liveKitRoomRef.current;
    if (lkRoom) {
      await restoreVoiceBeforeLeaveIfNeeded(lkRoom);
      await stopLiveKitLocalPublishing(lkRoom);
    } else {
      setPresenterVoiceBoostActive(false);
      voicePresetRestoreAfterScreenshareRef.current = null;
    }
    runCleanup({ skipGroupCallLeave: true });
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
  }, [callState, restoreVoiceBeforeLeaveIfNeeded, runCleanup]);

  const setMicrophoneMuted = useCallback(
    async (muted: boolean) => {
      const lkRoom = liveKitRoomRef.current;
      if (!lkRoom) return;
      await lkRoom.localParticipant.setMicrophoneEnabled(!muted);
      syncLocalMuteState(lkRoom);
      scheduleFeedBatched();
    },
    [scheduleFeedBatched, syncLocalMuteState],
  );

  const setCameraMuted = useCallback(
    async (muted: boolean) => {
      const lkRoom = liveKitRoomRef.current;
      if (!lkRoom) return;
      if (muted) {
        setCameraAccessBlocked(false);
      } else {
        const access = await requestLocalCameraAccess();
        if (!access.ok) {
          try {
            await lkRoom.localParticipant.setCameraEnabled(false);
          } catch {
            /* keep UI aligned with SDK */
          }
          setIsLocalVideoMuted(true);
          if (access.reason === 'permission_denied') {
            setCameraAccessBlocked(true);
          }
          return;
        }
        setCameraAccessBlocked(false);
      }
      await lkRoom.localParticipant.setCameraEnabled(!muted);
      if (!muted) {
        setCallKind('video');
        lastJoinKindRef.current = 'video';
      }
      syncLocalMuteState(lkRoom);
      refreshLocalPreview();
      scheduleFeedBatched();
    },
    [refreshLocalPreview, scheduleFeedBatched, syncLocalMuteState],
  );

  const setScreensharingEnabled = useCallback(
    (
      enabled: boolean,
      options?: { surfaceMode?: CallScreenshareSurfaceMode },
    ) => {
      if (options?.surfaceMode) {
        screenshareSurfaceModeRef.current = options.surfaceMode;
      }
      const run = async () => {
        const lkRoom = liveKitRoomRef.current;
        if (!lkRoom) return;
        setScreenshareErrorCode(null);

        const sdkSharing = isLocalScreenshareActiveInRoom(lkRoom);
        if (enabled) {
          if (sdkSharing) {
            setIsScreensharing(true);
            return;
          }
          const localUserId = client?.getUserId()?.trim() ?? null;
          const remoteOwner = getRemoteScreenshareOwnerFromRoom(lkRoom);
          if (
            remoteOwner &&
            localUserId &&
            remoteOwner.userId !== localUserId
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
          await enableLocalScreenshareDirect(lkRoom);
          return;
        }

        if (!sdkSharing && !isScreensharingRef.current) {
          setIsScreensharing(false);
          setScreenshareTabAudioMissing(false);
          return;
        }

        await reconcileLocalScreenshareStop(lkRoom);
      };

      const next = screenshareMutationRef.current.then(run, run);
      screenshareMutationRef.current = next;
      return next;
    },
    [
      client,
      enableLocalScreenshareDirect,
      reconcileLocalScreenshareStop,
      sendScreenshareTakeoverEvent,
    ],
  );

  setScreensharingEnabledRef.current = setScreensharingEnabled;

  const toggleScreensharing = useCallback(() => {
    const lkRoom = liveKitRoomRef.current;
    if (!lkRoom) return;
    const sdkSharing = isLocalScreenshareActiveInRoom(lkRoom);
    const sharing = sdkSharing || isScreensharingRef.current;
    void setScreensharingEnabled(!sharing);
  }, [setScreensharingEnabled]);

  const approveScreenshareTakeover = useCallback(
    async (request: ScreenshareTakeoverIncoming) => {
      const lkRoom = liveKitRoomRef.current;
      const localUserId = client?.getUserId()?.trim();
      if (!lkRoom || !localUserId || !request.requestId.trim()) return;
      setScreenshareTakeoverIncoming(null);
      try {
        if (isLocalScreenshareActiveInRoom(lkRoom)) {
          await lkRoom.localParticipant.setScreenShareEnabled(false);
        }
      } catch {
        // continue — still notify requester
      }
      syncLocalScreenshareState(lkRoom);
      await restorePresenterVoiceAfterScreenshare(lkRoom);
      await sendScreenshareTakeoverEvent(
        'approve',
        request.requestId.trim(),
        request.requesterUserId,
        localUserId,
      );
      scheduleFeedBatched();
      window.setTimeout(scheduleFeedBatched, 350);
      window.setTimeout(scheduleFeedBatched, 900);
    },
    [
      client,
      restorePresenterVoiceAfterScreenshare,
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
      voicePresetRestoreAfterScreenshareRef.current = null;
      setPresenterVoiceBoostActive(false);
      setVoiceProcessingPresetState(preset);
      persistVoiceProcessingPreset(preset);
      voiceProcessingPresetRef.current = preset;
    },
    [],
  );

  useEffect(() => {
    setVoiceProcessingPresetState(readVoiceProcessingPreset());
  }, []);

  useEffect(() => {
    voiceProcessingPresetRef.current = voiceProcessingPreset;
  }, [voiceProcessingPreset]);

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
    room,
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
    room,
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
      clearPersistedPendingRecordingUpload();
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
    const matrixRoom = client.getRoom(activeRoomId);
    const lkRoom = liveKitRoomRef.current;
    if (!matrixRoom || !lkRoom) return;

    const localUserId = client.getUserId() ?? null;
    const syncTakeoverFromTimeline = () => {
      const recent = matrixRoom
        .getLiveTimeline()
        ?.getEvents()
        ?.slice()
        .reverse();
      if (!recent?.length) return;

      const incoming = resolveIncomingScreenshareTakeover(
        recent,
        localUserId,
        isLocalScreenshareActiveInRoom(lkRoom),
        (senderId) => matrixRoom.getMember(senderId)?.name || senderId,
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
          void enableLocalScreenshareDirect(lkRoom);
          scheduleFeedBatched();
          window.setTimeout(scheduleFeedBatched, 350);
          window.setTimeout(scheduleFeedBatched, 900);
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
    matrixRoom.on(RoomEvent.Timeline, onTimeline);
    return () => {
      matrixRoom.off(RoomEvent.Timeline, onTimeline);
    };
  }, [
    callState,
    client,
    enableLocalScreenshareDirect,
    feedVersion,
    isScreensharing,
    roomId,
    scheduleFeedBatched,
  ]);

  const remoteScreenshareActive = useMemo(() => {
    const lkRoom = liveKitRoomRef.current ?? room;
    if (!lkRoom || isLocalScreenshareActiveInRoom(lkRoom)) return false;
    return isRemoteScreenshareActiveInRoom(lkRoom);
  }, [feedVersion, room, isScreensharing]);

  const captureConsent = useMemo(() => {
    const localCapture = resolveLocalCaptureConsent({
      captureMode,
      recordingStatus,
    });
    return resolveCaptureConsent(activeRoomCapture, localCapture);
  }, [activeRoomCapture, captureMode, recordingStatus]);

  useEffect(() => {
    if (!liveKitRoomRef.current) return;
    const pinnedCallRoomId = activeCallRoomIdRef.current;
    if (pinnedCallRoomId) {
      // Never tear down a pinned call when the hook room id changes or clears
      // (e.g. navigating to another space while the dock keeps the call).
      if (roomId !== pinnedCallRoomId) return;
      return;
    }
    if (activeCallRoomIdRef.current === roomId) return;
    if (lastRoomIdForTelemetryRef.current) {
      emitCallSessionEnd('room');
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
  }, [emitCallSessionEnd, roomId, runCleanup]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = () => {
      const inCall =
        callState === 'connecting' ||
        callState === 'connected' ||
        callState === 'awaiting_media' ||
        callState === 'initializing';
      const pipWindowOpen = isDocumentPictureInPictureWindowOpen();
      setTabBackgroundWhileInCall(
        inCall &&
          typeof document !== 'undefined' &&
          document.hidden &&
          !pipWindowOpen,
      );
      if (document.hidden || !inCall) return;
      const lkRoom = liveKitRoomRef.current;
      if (!lkRoom) return;
      scheduleFeedBatched();
      refreshLocalPreview();
    };
    document.addEventListener('visibilitychange', onVis);
    onVis();
    return () => {
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [callState, refreshLocalPreview, scheduleFeedBatched]);

  useEffect(() => {
    return () => {
      if (liveKitRoomRef.current && lastRoomIdForTelemetryRef.current) {
        emitCallSessionEnd('unmount');
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
  }, [emitCallSessionEnd]);

  // Best-effort MatrixRTC leave on tab/browser close.
  useEffect(() => {
    const handleBeforeUnload = (): void => {
      const session = rtcSessionRef.current;
      if (!session) return;
      void session.leaveRoomSession(5000).catch(() => undefined);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const idleRtcSessionUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    idleRtcSessionUnsubRef.current?.();
    idleRtcSessionUnsubRef.current = null;
    setIdleRoomParticipantCount(0);
    setIdleInCallUserIds([]);

    if (!client || !roomId?.trim()) return;
    if (liveKitRoomRef.current) return;
    if (callState !== 'idle' && callState !== 'error') return;

    const myId = client.getUserId() ?? null;
    const matrixRoom = client.getRoom(roomId);
    if (!matrixRoom) return;

    let watchedSession: MatrixRtcSessionLike | null = null;

    const unwatchMemberships = () => {
      if (watchedSession) {
        watchedSession.off(
          MATRIX_RTC_SESSION_EVENT.MembershipsChanged,
          syncIdleParticipants,
        );
        watchedSession = null;
      }
    };

    const syncIdleParticipants = () => {
      if (liveKitRoomRef.current) return;
      const session = getMatrixRtcSession(client, matrixRoom);
      if (watchedSession !== session) {
        unwatchMemberships();
        watchedSession = session;
        session.on(
          MATRIX_RTC_SESSION_EVENT.MembershipsChanged,
          syncIdleParticipants,
        );
      }
      const p = readParticipantsFromRtcMemberships(session.memberships, myId);
      if (p.count === 0) {
        setIdleRoomParticipantCount(0);
        setIdleInCallUserIds([]);
        return;
      }
      setIdleRoomParticipantCount(p.count);
      setIdleInCallUserIds(p.inCallUserIds);
    };

    syncIdleParticipants();

    const unsub = () => {
      unwatchMemberships();
    };
    idleRtcSessionUnsubRef.current = unsub;
    return () => {
      unsub();
    };
  }, [client, roomId, callState]);

  const dismissScreenshareError = useCallback(() => {
    setScreenshareErrorCode(null);
  }, []);

  const dismissScreenshareTabAudioHint = useCallback(() => {
    setScreenshareTabAudioMissing(false);
  }, []);

  const retryScreenshareWithTabAudio = useCallback(() => {
    const lkRoom = liveKitRoomRef.current;
    if (!lkRoom || !isLocalScreenshareActiveInRoom(lkRoom)) {
      return Promise.resolve();
    }

    const run = async () => {
      screenshareSurfaceModeRef.current = 'browser';
      setScreenshareTabAudioMissing(false);
      await reconcileLocalScreenshareStop(lkRoom);
      await enableLocalScreenshareDirect(lkRoom);
    };

    const next = screenshareMutationRef.current.then(run, run);
    screenshareMutationRef.current = next;
    return next;
  }, [enableLocalScreenshareDirect, reconcileLocalScreenshareStop]);

  const dismissCameraAccessBlocked = useCallback(() => {
    setCameraAccessBlocked(false);
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
    ? inCallUserIdsFromLiveKitRoom(liveKitRoomRef.current ?? room)
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
      /** Hide immediately when the room is empty — avoid "Call in progress — 0 members". */
      const hideDelayMs = idleRoomParticipantCount > 0 ? 2000 : 0;
      timer = setTimeout(() => setShowRoomCallInProgress(false), hideDelayMs);
    }
    return () => {
      if (timer != null) clearTimeout(timer);
    };
  }, [showRoomCallInProgressRaw, idleRoomParticipantCount]);

  return {
    callState,
    callSessionId,
    callSessionAnchorEventId,
    errorCode,
    screenshareErrorCode,
    screenshareTabAudioMissing,
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
    dismissScreenshareTabAudioHint,
    retryScreenshareWithTabAudio,
    cameraAccessBlocked,
    dismissCameraAccessBlocked,
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
    /** Feeds still warming — first ~45s after others appear in the call map. */
    remoteMediaWarming,
    /** Homeserver returned no usable TURN relay ICE servers for this session. */
    turnServerUnavailable,
    dismissTurnServerUnavailableBanner,
    dismissRemoteMediaStallBanner,
    retryRemoteMediaConnection,
    tabBackgroundWhileInCall,
    isCallRecovering,
    activeSpeakerKey,
    threadContext,
    callKind,
    enterAudio,
    enterVideo,
    leave,
    releaseLocalCallForTabTransfer,
    setMicrophoneMuted,
    setCameraMuted,
    setScreensharingEnabled,
    toggleScreensharing,
    voiceProcessingPreset,
    setVoiceProcessingPreset,
    /** WCUX-SHARE-VOICE-5: auto voice boost while presenting from Speech preset. */
    presenterVoiceBoostActive,
    isScreensharing,
    /** Another participant is presenting — local share start is blocked (one at a time). */
    remoteScreenshareActive,
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
    room,
    feedVersion,
  };
}
