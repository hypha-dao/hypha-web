/**
 * Front-camera orientation for Matrix group calls.
 *
 * Local preview is mirrored in the UI (Zoom/Teams-style selfie view). Remote
 * participants must receive canonical (non-mirrored) video. WebKit often
 * delivers a mirrored MediaStreamTrack from user-facing cameras — flip once
 * before publish via `updateLocalUsermediaStream`.
 */

export function isUserFacingCallVideoTrack(
  track: MediaStreamTrack | null | undefined,
): boolean {
  if (!track || track.kind !== 'video') return false;
  const facing = track.getSettings?.().facingMode;
  if (facing === 'environment') return false;
  return true;
}

import { isIOSTouchDevice } from './screenshare-capture';

/** WebKit user-facing capture is mirrored in the encoded track; peers need a flip. */
export function shouldCorrectOutboundUserFacingVideoTrack(
  track: MediaStreamTrack,
): boolean {
  if (!isUserFacingCallVideoTrack(track)) return false;
  if (typeof navigator === 'undefined') return false;
  /**
   * Canvas `captureStream` publish is unreliable on iPad/iPhone (Safari and CriOS).
   * Keep the native camera track; local preview stays mirrored via CSS.
   */
  if (isIOSTouchDevice()) return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isWebKit =
    /AppleWebKit/i.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|Chrome|Chromium|Edg\//i.test(ua);
  return isIOS || isWebKit;
}

export function shouldMirrorCallFeedVideoForDisplay(input: {
  isShare: boolean;
  isLocalFeed: boolean;
  videoTrack: MediaStreamTrack | null | undefined;
}): boolean {
  return (
    !input.isShare &&
    input.isLocalFeed &&
    isUserFacingCallVideoTrack(input.videoTrack)
  );
}

type FlippedVideoTrack = {
  track: MediaStreamTrack;
  dispose: () => void;
};

function createFlippedVideoTrackWithCanvas(
  source: MediaStreamTrack,
): FlippedVideoTrack | null {
  if (typeof document === 'undefined') return null;

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.srcObject = new MediaStream([source]);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let disposed = false;
  let frameHandle = 0;
  let settingsApplied = false;

  const draw = () => {
    if (disposed) return;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width > 0 && height > 0) {
      if (
        !settingsApplied ||
        canvas.width !== width ||
        canvas.height !== height
      ) {
        canvas.width = width;
        canvas.height = height;
        settingsApplied = true;
      }
      ctx.save();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, width, height);
      ctx.restore();
    }
    frameHandle = window.requestAnimationFrame(draw);
  };

  const start = () => {
    void video.play().catch(() => undefined);
    frameHandle = window.requestAnimationFrame(draw);
  };

  video.addEventListener('loadedmetadata', start);
  if (video.readyState >= 1) start();

  const capture = canvas.captureStream(30);
  const track = capture.getVideoTracks()[0];
  if (!track) {
    window.cancelAnimationFrame(frameHandle);
    video.srcObject = null;
    return null;
  }

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    window.cancelAnimationFrame(frameHandle);
    track.stop();
    for (const t of capture.getTracks()) {
      if (t !== track && t.readyState !== 'ended') t.stop();
    }
    video.pause();
    video.srcObject = null;
  };

  source.addEventListener('ended', dispose, { once: true });

  return { track, dispose };
}

/** Returns a horizontally flipped clone suitable for WebRTC publish. */
export function createHorizontallyFlippedVideoTrack(
  source: MediaStreamTrack,
): FlippedVideoTrack | null {
  if (source.kind !== 'video' || source.readyState !== 'live') return null;
  return createFlippedVideoTrackWithCanvas(source);
}

export async function applyOutboundLocalVideoOrientation(
  updateLocalUsermediaStream: (stream: MediaStream) => Promise<void>,
  stream: MediaStream | null | undefined,
  options?: {
    processedSourceTrackIds?: Set<string>;
    onFlippedTrackDispose?: (dispose: () => void) => void;
  },
): Promise<boolean> {
  const videoTrack = stream?.getVideoTracks()[0];
  if (!videoTrack || videoTrack.readyState !== 'live') return false;
  if (!shouldCorrectOutboundUserFacingVideoTrack(videoTrack)) return false;
  if (options?.processedSourceTrackIds?.has(videoTrack.id)) return false;

  const flipped = createHorizontallyFlippedVideoTrack(videoTrack);
  if (!flipped) return false;

  const nextStream = new MediaStream();
  for (const track of stream?.getAudioTracks() ?? []) {
    if (track.readyState === 'live') nextStream.addTrack(track);
  }
  nextStream.addTrack(flipped.track);

  await updateLocalUsermediaStream(nextStream);
  options?.processedSourceTrackIds?.add(videoTrack.id);
  options?.onFlippedTrackDispose?.(flipped.dispose);
  return true;
}
