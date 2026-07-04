import {
  Room,
  RoomEvent,
  Track,
  type LocalParticipant,
  type RemoteParticipant,
} from 'livekit-client';
import {
  MATRIX_RTC_SESSION_EVENT,
  type MatrixRtcSessionLike,
} from './matrix-rtc-events';

export function createLiveKitRoom(): Room {
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
  const localId = room.localParticipant.identity;
  if (localId && localId !== excludeUserId) {
    userIdSet.add(localId);
  }
  for (const participant of room.remoteParticipants.values()) {
    const id = participant.identity?.trim();
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
      const userId = participant.identity?.trim();
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
  return speakers[0]?.identity?.trim() || null;
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
