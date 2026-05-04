/**
 * Privacy-safe, client-only telemetry for group calls. No PII; room id is
 * a Matrix opaque id. Enable debug logs in dev via the browser console filter
 * "hypha.group_call".
 */

export type SpaceGroupCallTelemetryEvent = {
  name:
    | 'hypha.group_call.join_ms'
    | 'hypha.group_call.left'
    | 'hypha.group_call.error'
    | 'hypha.group_call.connected'
    | 'hypha.group_call.media_snapshot'
    | 'hypha.group_call.remote_media_stall'
    | 'hypha.group_call.turn_probe'
    | 'hypha.group_call.ice_gather_probe'
    | 'hypha.group_call.webrtc_summary';
  roomId: string;
  kind?: 'audio' | 'video';
  joinMs?: number;
  errorCode?: string;
  reason?: 'user' | 'error' | 'room' | 'unmount';
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
    if (process.env.NODE_ENV === 'development') {
      console.info('[hypha.group_call]', event);
    }
  } catch {
    // ignore
  }
}
