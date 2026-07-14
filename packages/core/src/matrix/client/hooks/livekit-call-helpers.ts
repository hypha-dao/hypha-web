import {
  LogLevel,
  Room,
  RoomEvent,
  setLogLevel,
  Track,
  type LocalParticipant,
  type RemoteParticipant,
} from 'livekit-client';
import { isMatrixCallDebugEnabled } from '../matrix-webrtc-env';
import {
  MATRIX_RTC_SESSION_EVENT,
  type MatrixRtcSessionLike,
} from './matrix-rtc-events';

/**
 * LiveKit identity is minted as the Matrix user id, but some SFU/JWT-service
 * configurations append a trailing `:<device-id>` separator that's empty
 * (e.g. `@user:server.tld:`). That stray colon round-trips fine for
 * LiveKit-to-LiveKit comparisons (they're all self-consistent) but breaks
 * cross-system equality checks against a real Matrix user id (`client.getUserId()`
 * never has one) — notably screenshare-takeover's `target_user_id` matching.
 * Normalize once, here, so every call site gets a clean Matrix user id.
 */
export function matrixUserIdFromLiveKitIdentity(
  identity: string | null | undefined,
): string | null {
  const trimmed = identity?.trim();
  if (!trimmed) return null;
  let end = trimmed.length;
  while (end > 0 && trimmed.charAt(end - 1) === ':') end -= 1;
  return trimmed.slice(0, end) || null;
}

export function createLiveKitRoom(): Room {
  if (isMatrixCallDebugEnabled()) {
    // Surfaces livekit-client's internal ICE gathering/negotiation trace
    // (candidate additions, SDP offer/answer, connection state) in the
    // console under the "hypha.group_call" filter's neighborhood, useful
    // when diagnosing second-joiner connect failures.
    setLogLevel(LogLevel.debug);
  }
  return new Room({
    adaptiveStream: true,
    dynacast: true,
  });
}

export function readParticipantsFromLiveKitRoom(
  room: Room,
  excludeUserId?: string | null,
): { count: number; inCallUserIds: string[] } {
  const userIdSet = new Set<string>();
  const localId = matrixUserIdFromLiveKitIdentity(
    room.localParticipant.identity,
  );
  if (localId && localId !== excludeUserId) {
    userIdSet.add(localId);
  }
  for (const participant of room.remoteParticipants.values()) {
    const id = matrixUserIdFromLiveKitIdentity(participant.identity);
    if (!id || id === excludeUserId) continue;
    userIdSet.add(id);
  }
  return { count: userIdSet.size, inCallUserIds: [...userIdSet] };
}

export function readParticipantsFromRtcMemberships(
  memberships: Array<{ sender: string; isExpired(): boolean }>,
  excludeUserId?: string | null,
): { count: number; inCallUserIds: string[] } {
  const userIdSet = new Set<string>();
  for (const membership of memberships) {
    const userId = membership.sender?.trim();
    if (!userId || userId === excludeUserId) continue;
    if (membership.isExpired?.()) continue;
    userIdSet.add(userId);
  }
  return { count: userIdSet.size, inCallUserIds: [...userIdSet] };
}

export function getRemoteScreenshareOwnerFromRoom(
  room: Room | null | undefined,
): { userId: string } | null {
  if (!room) return null;
  for (const participant of room.remoteParticipants.values()) {
    const pub = participant.getTrackPublication(Track.Source.ScreenShare);
    if (pub?.track && !pub.isMuted) {
      const userId = matrixUserIdFromLiveKitIdentity(participant.identity);
      if (userId) return { userId };
    }
  }
  return null;
}

export function isRemoteScreenshareActiveInRoom(
  room: Room | null | undefined,
): boolean {
  return getRemoteScreenshareOwnerFromRoom(room) != null;
}

export function isLocalScreenshareActiveInRoom(
  room: Room | null | undefined,
): boolean {
  if (!room) return false;
  const pub = room.localParticipant.getTrackPublication(
    Track.Source.ScreenShare,
  );
  return Boolean(pub?.track && !pub.isMuted);
}

export function syncLocalMuteStateFromRoom(
  localParticipant: LocalParticipant,
): { micMuted: boolean; cameraMuted: boolean; screensharing: boolean } {
  const micPub = localParticipant.getTrackPublication(Track.Source.Microphone);
  const camPub = localParticipant.getTrackPublication(Track.Source.Camera);
  const sharePub = localParticipant.getTrackPublication(
    Track.Source.ScreenShare,
  );
  return {
    micMuted: !micPub?.track || micPub.isMuted,
    cameraMuted: !camPub?.track || camPub.isMuted,
    screensharing: Boolean(sharePub?.track && !sharePub.isMuted),
  };
}

export function localPreviewStreamFromRoom(
  room: Room | null | undefined,
): MediaStream | null {
  if (!room) return null;
  const tracks: MediaStreamTrack[] = [];
  const cam = room.localParticipant.getTrackPublication(Track.Source.Camera);
  const mic = room.localParticipant.getTrackPublication(
    Track.Source.Microphone,
  );
  const camTrack = cam?.track?.mediaStreamTrack;
  const micTrack = mic?.track?.mediaStreamTrack;
  if (camTrack) tracks.push(camTrack);
  if (micTrack) tracks.push(micTrack);
  if (tracks.length === 0) return null;
  return new MediaStream(tracks);
}

export function activeSpeakerKeyFromRoom(room: Room | null): string | null {
  if (!room) return null;
  const speakers = room.activeSpeakers;
  if (speakers.length === 0) return null;
  return matrixUserIdFromLiveKitIdentity(speakers[0]?.identity);
}

/**
 * Debug-only visibility into the connect/negotiate timeline, independent of
 * `attachLiveKitRoomMediaListeners`. Attached before `room.connect()` so it
 * also captures the state transitions that happen during connect itself
 * (join-as-second-participant subscriber negotiation vs. join-as-first
 * publisher-only negotiation).
 */
export function attachLiveKitRtcDebugListeners(
  room: Room,
  context: { roomId: string; kind: 'audio' | 'video' },
): LiveKitRoomListenerCleanup {
  if (!isMatrixCallDebugEnabled()) return () => undefined;
  const t0 =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  const elapsed = () =>
    Math.round(
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
        t0,
    );
  const onConnectionStateChanged = (state: string) => {
    console.info('[hypha.group_call.debug] connectionStateChanged', {
      ...context,
      state,
      elapsedMs: elapsed(),
      remoteParticipants: room.remoteParticipants.size,
    });
  };
  const onSignalReconnecting = () => {
    console.info('[hypha.group_call.debug] signalReconnecting', {
      ...context,
      elapsedMs: elapsed(),
    });
  };
  const onReconnecting = () => {
    console.info('[hypha.group_call.debug] reconnecting', {
      ...context,
      elapsedMs: elapsed(),
    });
  };
  const onReconnected = () => {
    console.info('[hypha.group_call.debug] reconnected', {
      ...context,
      elapsedMs: elapsed(),
    });
  };
  const onDisconnected = (reason?: unknown) => {
    console.info('[hypha.group_call.debug] disconnected', {
      ...context,
      reason,
      elapsedMs: elapsed(),
    });
  };
  const onParticipantConnected = (participant: RemoteParticipant) => {
    console.info('[hypha.group_call.debug] remoteParticipantConnected', {
      ...context,
      remoteIdentity: participant.identity,
      elapsedMs: elapsed(),
    });
  };
  const onTrackSubscribed = () => {
    console.info('[hypha.group_call.debug] trackSubscribed', {
      ...context,
      elapsedMs: elapsed(),
    });
  };
  const onTrackSubscriptionFailed = (trackSid: string) => {
    console.warn('[hypha.group_call.debug] trackSubscriptionFailed', {
      ...context,
      trackSid,
      elapsedMs: elapsed(),
    });
  };
  console.info('[hypha.group_call.debug] listenersAttached', {
    ...context,
    remoteParticipantsAtAttach: room.remoteParticipants.size,
  });
  room.on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
  room.on(RoomEvent.SignalReconnecting, onSignalReconnecting);
  room.on(RoomEvent.Reconnecting, onReconnecting);
  room.on(RoomEvent.Reconnected, onReconnected);
  room.on(RoomEvent.Disconnected, onDisconnected);
  room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
  room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
  room.on(RoomEvent.TrackSubscriptionFailed, onTrackSubscriptionFailed);
  return () => {
    room.off(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
    room.off(RoomEvent.SignalReconnecting, onSignalReconnecting);
    room.off(RoomEvent.Reconnecting, onReconnecting);
    room.off(RoomEvent.Reconnected, onReconnected);
    room.off(RoomEvent.Disconnected, onDisconnected);
    room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.off(RoomEvent.TrackSubscriptionFailed, onTrackSubscriptionFailed);
  };
}

export type LiveKitRoomListenerCleanup = () => void;

export function attachLiveKitRoomMediaListeners(
  room: Room,
  handlers: {
    onMediaChanged: () => void;
    onActiveSpeakersChanged: () => void;
    onDisconnected?: () => void;
    onReconnecting?: () => void;
    onReconnected?: () => void;
  },
): LiveKitRoomListenerCleanup {
  const onTrackOrParticipant = () => handlers.onMediaChanged();
  room.on(RoomEvent.TrackSubscribed, onTrackOrParticipant);
  room.on(RoomEvent.TrackUnsubscribed, onTrackOrParticipant);
  room.on(RoomEvent.TrackMuted, onTrackOrParticipant);
  room.on(RoomEvent.TrackUnmuted, onTrackOrParticipant);
  room.on(RoomEvent.ParticipantConnected, onTrackOrParticipant);
  room.on(RoomEvent.ParticipantDisconnected, onTrackOrParticipant);
  room.on(RoomEvent.LocalTrackPublished, onTrackOrParticipant);
  room.on(RoomEvent.LocalTrackUnpublished, onTrackOrParticipant);
  room.on(RoomEvent.ActiveSpeakersChanged, handlers.onActiveSpeakersChanged);
  if (handlers.onDisconnected) {
    room.on(RoomEvent.Disconnected, handlers.onDisconnected);
  }
  if (handlers.onReconnecting) {
    room.on(RoomEvent.Reconnecting, handlers.onReconnecting);
  }
  if (handlers.onReconnected) {
    room.on(RoomEvent.Reconnected, handlers.onReconnected);
  }
  return () => {
    room.off(RoomEvent.TrackSubscribed, onTrackOrParticipant);
    room.off(RoomEvent.TrackUnsubscribed, onTrackOrParticipant);
    room.off(RoomEvent.TrackMuted, onTrackOrParticipant);
    room.off(RoomEvent.TrackUnmuted, onTrackOrParticipant);
    room.off(RoomEvent.ParticipantConnected, onTrackOrParticipant);
    room.off(RoomEvent.ParticipantDisconnected, onTrackOrParticipant);
    room.off(RoomEvent.LocalTrackPublished, onTrackOrParticipant);
    room.off(RoomEvent.LocalTrackUnpublished, onTrackOrParticipant);
    room.off(RoomEvent.ActiveSpeakersChanged, handlers.onActiveSpeakersChanged);
    if (handlers.onDisconnected) {
      room.off(RoomEvent.Disconnected, handlers.onDisconnected);
    }
    if (handlers.onReconnecting) {
      room.off(RoomEvent.Reconnecting, handlers.onReconnecting);
    }
    if (handlers.onReconnected) {
      room.off(RoomEvent.Reconnected, handlers.onReconnected);
    }
  };
}

export async function waitForRtcSessionJoined(
  session: MatrixRtcSessionLike,
  timeoutMs = 30_000,
): Promise<void> {
  if (session.isJoined()) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      session.off(MATRIX_RTC_SESSION_EVENT.JoinStateChanged, onJoin);
      reject(new Error('MatrixRTC session join timed out'));
    }, timeoutMs);
    const onJoin = (joined: unknown) => {
      if (joined !== true) return;
      clearTimeout(timer);
      session.off(MATRIX_RTC_SESSION_EVENT.JoinStateChanged, onJoin);
      resolve();
    };
    session.on(MATRIX_RTC_SESSION_EVENT.JoinStateChanged, onJoin);
  });
}

export function participantHasLiveCamera(
  participant: LocalParticipant | RemoteParticipant,
): boolean {
  const pub = participant.getTrackPublication(Track.Source.Camera);
  return Boolean(pub?.track && !pub.isMuted);
}
