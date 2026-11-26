import {
  ScreenSharePresets,
  Track,
  VideoPreset,
  type LocalTrack,
  type Room,
  type ScreenShareCaptureOptions,
  type TrackPublishOptions,
} from 'livekit-client';

/**
 * How a screenshare is captured and sent (#2742). Fixed for every share; compared on a preview
 * with sharer-side settings before settling on these values:
 * - capture up to 1440p (smaller screens and windows keep their own size, nothing is scaled up);
 * - 15 fps and up to 4 Mbps for the full size (a still screen uses far less; the cap matters while
 *   scrolling or playing video);
 * - VP8, which every browser decodes;
 * - two smaller copies picked from the shared size (`screenShareCopyHeights`).
 */
const CAPTURE_MAX = { width: 2560, height: 1440 } as const;
const FRAME_RATE = 15;
const MAX_BITRATE = 4_000_000;

/** Copy presets by height. 540p sits between LiveKit's 360p and 720p screen presets. */
const COPY_PRESETS: Record<number, VideoPreset> = {
  360: ScreenSharePresets.h360fps15,
  540: new VideoPreset(960, 540, 900_000, 15, 'medium'),
  720: ScreenSharePresets.h720fps15,
  1080: ScreenSharePresets.h1080fps15,
};

/** A share counts as "above 1080p" from here, so a 1200p screen does not get a near-equal 1080p copy. */
const LARGE_SOURCE_MIN_HEIGHT = 1350;

/**
 * Heights of the smaller copies sent below the full size. A large share (e.g. 1440p) sends 1080p for
 * most viewers and 540p for weak connections; 1080p or smaller sends 720p and 360p. Copies that are
 * not clearly smaller than the shared picture are dropped, so a small window sends fewer.
 * `sourceHeight` is the short side of the captured picture; unknown keeps 720p and 360p.
 */
export function screenShareCopyHeights(sourceHeight?: number): number[] {
  if (sourceHeight === undefined || !(sourceHeight > 0)) return [360, 720];
  const heights =
    sourceHeight >= LARGE_SOURCE_MIN_HEIGHT ? [540, 1080] : [360, 720];
  return heights.filter((h) => h < sourceHeight * 0.9);
}

export function buildScreenShareCaptureOptions(): ScreenShareCaptureOptions {
  // The capture runs at 30 fps (livekit-client's default); the encoder sets the sent rate.
  return {
    contentHint: 'detail',
    resolution: { ...CAPTURE_MAX, frameRate: 30 },
  };
}

/**
 * Publish options for a share of `source` size. `maintain-resolution`: on a short uplink frames
 * drop, not pixels.
 */
export function buildScreenSharePublishOptions(source?: {
  width: number;
  height: number;
}): TrackPublishOptions {
  const sourceHeight = source
    ? Math.min(source.width, source.height)
    : undefined;
  const copies = screenShareCopyHeights(sourceHeight)
    .map((h) => COPY_PRESETS[h])
    .filter((preset): preset is VideoPreset => preset !== undefined);
  return {
    simulcast: true,
    videoCodec: 'vp8',
    screenShareEncoding: { maxBitrate: MAX_BITRATE, maxFramerate: FRAME_RATE },
    screenShareSimulcastLayers: copies,
    degradationPreference: 'maintain-resolution',
  };
}

/** One start per room at a time, like LiveKit's own pending-publish guard (e.g. a double click). */
const startsInFlight = new WeakMap<Room, Promise<void>>();

/**
 * Starts a share in two steps so the copies can follow the picked surface: capture first (the
 * browser picker), then publish with copies chosen from the captured size. Same steps as
 * `setScreenShareEnabled(true)`, which picks the copies before it knows the size. A no-op when
 * this client already shares.
 */
export function publishScreenShare(room: Room): Promise<void> {
  const pending = startsInFlight.get(room);
  if (pending) return pending;
  const start = startScreenShare(room).finally(() => {
    startsInFlight.delete(room);
  });
  startsInFlight.set(room, start);
  return start;
}

async function startScreenShare(room: Room): Promise<void> {
  // Already sharing (e.g. a takeover approval after a manual start): keep that share, as
  // `setScreenShareEnabled(true)` does, instead of opening a second picker and track.
  const existing = room.localParticipant.getTrackPublication(
    Track.Source.ScreenShare,
  );
  if (existing?.track) {
    if (existing.isMuted) await existing.unmute();
    return;
  }
  const tracks: LocalTrack[] = await room.localParticipant.createScreenTracks(
    buildScreenShareCaptureOptions(),
  );
  try {
    const video = tracks.find((t) => t.source === Track.Source.ScreenShare);
    const size = video?.mediaStreamTrack.getSettings();
    const publish = buildScreenSharePublishOptions(
      size?.width && size?.height
        ? { width: size.width, height: size.height }
        : undefined,
    );
    await Promise.all(
      tracks.map((t) => room.localParticipant.publishTrack(t, publish)),
    );
  } catch (e) {
    for (const t of tracks) t.stop();
    throw e;
  }
}
