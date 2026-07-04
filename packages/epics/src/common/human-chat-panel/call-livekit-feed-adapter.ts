import { CallFeedEvent } from 'matrix-js-sdk/lib/webrtc/callFeed';
import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';
import {
  Room,
  Track,
  ParticipantEvent,
  TrackEvent,
  type LocalParticipant,
  type RemoteParticipant,
} from 'livekit-client';

type FeedListener = () => void;

class LiveKitAdaptedCallFeed {
  userId: string;
  deviceId: string;
  purpose: 'user-media' | 'screenshare';
  stream: MediaStream | undefined;
  private readonly isLocalFeed: boolean;
  private readonly trackSource: Track.Source.Camera | Track.Source.ScreenShare;
  private readonly participant: LocalParticipant | RemoteParticipant;
  private readonly listeners = new Map<CallFeedEvent, Set<FeedListener>>();
  private disposers: Array<() => void> = [];

  constructor(options: {
    participant: LocalParticipant | RemoteParticipant;
    trackSource: Track.Source.Camera | Track.Source.ScreenShare;
    isLocal: boolean;
  }) {
    this.participant = options.participant;
    this.trackSource = options.trackSource;
    this.isLocalFeed = options.isLocal;
    this.userId = options.participant.identity?.trim() || '';
    this.deviceId = options.participant.sid?.trim() || '';
    this.purpose =
      options.trackSource === Track.Source.ScreenShare
        ? 'screenshare'
        : 'user-media';
    this.stream = this.buildStream();
    this.bindParticipantEvents();
  }

  private buildStream(): MediaStream | undefined {
    const tracks: MediaStreamTrack[] = [];
    if (this.trackSource === Track.Source.Camera) {
      const cam = this.participant.getTrackPublication(Track.Source.Camera);
      const mic = this.participant.getTrackPublication(Track.Source.Microphone);
      const camTrack = cam?.track?.mediaStreamTrack;
      const micTrack = mic?.track?.mediaStreamTrack;
      if (camTrack) tracks.push(camTrack);
      if (micTrack) tracks.push(micTrack);
    } else {
      const share = this.participant.getTrackPublication(
        Track.Source.ScreenShare,
      );
      const shareAudio = this.participant.getTrackPublication(
        Track.Source.ScreenShareAudio,
      );
      const shareTrack = share?.track?.mediaStreamTrack;
      const shareAudioTrack = shareAudio?.track?.mediaStreamTrack;
      if (shareTrack) tracks.push(shareTrack);
      if (shareAudioTrack) tracks.push(shareAudioTrack);
    }
    if (tracks.length === 0) return undefined;
    return new MediaStream(tracks);
  }

  private bindParticipantEvents(): void {
    const refresh = () => {
      this.stream = this.buildStream();
      this.emit(CallFeedEvent.NewStream);
      this.emit(CallFeedEvent.MuteStateChanged);
    };
    const onMute = () => {
      this.emit(CallFeedEvent.MuteStateChanged);
    };
    this.participant.on(ParticipantEvent.TrackSubscribed, refresh);
    this.participant.on(ParticipantEvent.TrackUnpublished, refresh);
    this.participant.on(ParticipantEvent.TrackMuted, onMute);
    this.participant.on(ParticipantEvent.TrackUnmuted, onMute);
    this.disposers.push(() => {
      this.participant.off(ParticipantEvent.TrackSubscribed, refresh);
      this.participant.off(ParticipantEvent.TrackUnpublished, refresh);
      this.participant.off(ParticipantEvent.TrackMuted, onMute);
      this.participant.off(ParticipantEvent.TrackUnmuted, onMute);
    });
    for (const pub of this.participant.trackPublications.values()) {
      const track = pub.track;
      if (!track) continue;
      const onTrackMute = () => this.emit(CallFeedEvent.MuteStateChanged);
      track.on(TrackEvent.Muted, onTrackMute);
      track.on(TrackEvent.Unmuted, onTrackMute);
      this.disposers.push(() => {
        track.off(TrackEvent.Muted, onTrackMute);
        track.off(TrackEvent.Unmuted, onTrackMute);
      });
    }
  }

  private emit(event: CallFeedEvent): void {
    for (const handler of this.listeners.get(event) ?? []) {
      handler();
    }
  }

  isLocal(): boolean {
    return this.isLocalFeed;
  }

  isVideoMuted(): boolean {
    if (this.trackSource === Track.Source.ScreenShare) {
      const pub = this.participant.getTrackPublication(
        Track.Source.ScreenShare,
      );
      return !pub?.track || pub.isMuted;
    }
    const pub = this.participant.getTrackPublication(Track.Source.Camera);
    return !pub?.track || pub.isMuted;
  }

  isAudioMuted(): boolean {
    if (this.trackSource === Track.Source.ScreenShare) {
      const shareAudio = this.participant.getTrackPublication(
        Track.Source.ScreenShareAudio,
      );
      if (shareAudio?.track) return shareAudio.isMuted;
      return true;
    }
    const pub = this.participant.getTrackPublication(Track.Source.Microphone);
    return !pub?.track || pub.isMuted;
  }

  on(event: CallFeedEvent, handler: FeedListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: CallFeedEvent, handler: FeedListener): void {
    this.listeners.get(event)?.delete(handler);
  }

  dispose(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
    this.listeners.clear();
  }
}

function asCallFeed(feed: LiveKitAdaptedCallFeed): CallFeed {
  return feed as unknown as CallFeed;
}

export function buildCallFeedsFromLiveKitRoom(room: Room | null): {
  userMediaFeeds: CallFeed[];
  screenshareFeeds: CallFeed[];
  dispose: () => void;
} {
  if (!room) {
    return {
      userMediaFeeds: [],
      screenshareFeeds: [],
      dispose: () => undefined,
    };
  }

  const adapted: LiveKitAdaptedCallFeed[] = [];
  const userMediaFeeds: CallFeed[] = [];
  const screenshareFeeds: CallFeed[] = [];

  const addParticipant = (
    participant: LocalParticipant | RemoteParticipant,
    isLocal: boolean,
  ) => {
    const cameraFeed = new LiveKitAdaptedCallFeed({
      participant,
      trackSource: Track.Source.Camera,
      isLocal,
    });
    adapted.push(cameraFeed);
    userMediaFeeds.push(asCallFeed(cameraFeed));

    const sharePub = participant.getTrackPublication(Track.Source.ScreenShare);
    if (sharePub?.track) {
      const shareFeed = new LiveKitAdaptedCallFeed({
        participant,
        trackSource: Track.Source.ScreenShare,
        isLocal,
      });
      adapted.push(shareFeed);
      screenshareFeeds.push(asCallFeed(shareFeed));
    }
  };

  addParticipant(room.localParticipant, true);
  for (const participant of room.remoteParticipants.values()) {
    addParticipant(participant, false);
  }

  return {
    userMediaFeeds,
    screenshareFeeds,
    dispose: () => {
      for (const feed of adapted) feed.dispose();
    },
  };
}

/** LiveKit identity is the Matrix user id — no device suffix. */
export function feedKeyForActive(feed: Pick<CallFeed, 'userId'>): string {
  return feed.userId?.trim() || '';
}
