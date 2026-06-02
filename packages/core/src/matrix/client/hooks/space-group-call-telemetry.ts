/**
 * Privacy-safe, client-only telemetry for group calls. No PII; room id is
 * a Matrix opaque id. Enable debug logs in dev, or in preview with
 * `NEXT_PUBLIC_MATRIX_WEBRTC_DEBUG=true`, via the browser console filter
 * "hypha.group_call".
 */

import { matrixWebRtcDebugFromEnv } from '../matrix-webrtc-env';
import {
  getMatrixCallSessionMetrics,
  resetMatrixCallSessionMetrics,
} from './matrix-call-session-metrics';

export type GroupCallSessionEndReason = 'user' | 'error' | 'room' | 'unmount';

export type SpaceGroupCallTelemetryEvent = {
  name:
    | 'hypha.group_call.join_ms'
    | 'hypha.group_call.left'
    | 'hypha.group_call.error'
    | 'hypha.group_call.error_ignored'
    | 'hypha.group_call.connected'
    | 'hypha.group_call.media_snapshot'
    | 'hypha.group_call.remote_media_stall'
    | 'hypha.group_call.remote_media_recover'
    | 'hypha.group_call.turn_probe'
    | 'hypha.group_call.ice_gather_probe'
    | 'hypha.group_call.webrtc_summary'
    | 'hypha.group_call.room_type_sync'
    | 'hypha.group_call.capture_started'
    | 'hypha.group_call.session_end';
  roomId: string;
  kind?: 'audio' | 'video';
  captureMode?: string;
  hasRecorder?: boolean;
  hasGroupCall?: boolean;
  /** Matrix group call state event `m.type` before sync (voice→video upgrade). */
  previousRoomGroupCallType?: string;
  /** Matrix group call state event `m.type` after sync. */
  roomGroupCallType?: string;
  joinMs?: number;
  errorCode?: string;
  reason?: GroupCallSessionEndReason;
  /** Active call duration at session end (WCUX-SESSION-6). */
  durationMs?: number;
  /** Successful in-call Matrix token refreshes during the session. */
  tokenRefreshCount?: number;
  /** Last Matrix token/sync error observed during the session. */
  lastMatrixError?: string;
  /** Matrix group call id (opaque); helps confirm both peers share one session. */
  groupCallId?: string;
  userMediaFeedCount?: number;
  remoteUserMediaFeedCount?: number;
  screenshareFeedCount?: number;
  participantDeviceCount?: number;
  /** Room state lists them in-call but no userMedia CallFeed yet (WebRTC lag / failure). */
  missingRemoteFeedCount?: number;
  waitedMs?: number;
  /** Result of `client.checkTurnServers()` — homeserver returned usable TURN URIs. */
  turnCredsOk?: boolean;
  /** Approximate seconds until TURN credential expiry (from client clock). */
  turnTtlSecApprox?: number;
  /** From `client.getTurnServers()` mapped for RTCPeerConnection — counts only; no URIs/credentials. */
  iceEntryCount?: number;
  iceUrlCount?: number;
  iceHasStun?: boolean;
  iceHasTurn?: boolean;
  iceHasTurns?: boolean;
  /** First hostname label samples from ICE URLs (privacy-safe hints for infra debugging). */
  iceHostHints?: string[];
  forceTurn?: boolean;
  fallbackIceAllowed?: boolean;
  iceGatherState?: RTCIceGatheringState | 'unsupported' | 'timeout';
  /** Matrix SDK summary stats (subset); see `SummaryStatsReport`. */
  percentageReceivedMedia?: number;
  percentageReceivedAudioMedia?: number;
  percentageReceivedVideoMedia?: number;
  maxJitter?: number;
  maxPacketLoss?: number;
  percentageConcealedAudio?: number;
  peerConnections?: number;
  opponentUsersInCall?: number;
  opponentDevicesInCall?: number;
  diffDevicesToPeerConnections?: number;
  ratioPeerConnectionToDevices?: number;
};

export function logSpaceGroupCallEvent(
  event: SpaceGroupCallTelemetryEvent,
): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return;
  }
  try {
    const debugOverrideEnabled =
      typeof window !== 'undefined' &&
      window.localStorage.getItem('hypha.group_call.debug') === '1';
    if (
      process.env.NODE_ENV === 'development' ||
      (matrixWebRtcDebugFromEnv() && debugOverrideEnabled)
    ) {
      console.info('[hypha.group_call]', event);
    }
  } catch {
    // ignore
  }
}

export function logGroupCallSessionEnd(params: {
  roomId: string;
  kind?: 'audio' | 'video';
  reason: GroupCallSessionEndReason;
  startedAtMs: number | null;
}): void {
  const metrics = getMatrixCallSessionMetrics();
  const durationMs =
    params.startedAtMs != null
      ? Math.max(0, Math.round(Date.now() - params.startedAtMs))
      : undefined;
  logSpaceGroupCallEvent({
    name: 'hypha.group_call.session_end',
    roomId: params.roomId,
    kind: params.kind,
    reason: params.reason,
    durationMs,
    tokenRefreshCount: metrics.tokenRefreshCount,
    lastMatrixError: metrics.lastMatrixError ?? undefined,
  });
  resetMatrixCallSessionMetrics();
}
