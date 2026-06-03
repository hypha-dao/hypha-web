/**
 * Matrix `MediaHandler.getUserMediaContraints` defaults to 640×360 ideal.
 * Hypha patches it for the call session to request 720p capture (WCUX-QUALITY-1).
 */

import { isIOSTouchDevice } from './screenshare-capture';

export const MATRIX_CAMERA_CAPTURE_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
  frameRate: { ideal: 24, max: 30 },
  facingMode: 'user',
};

/** iPad/iPhone front cameras reject aggressive width/height caps — keep facingMode only. */
export const IOS_TOUCH_CAMERA_CAPTURE_VIDEO_CONSTRAINTS: MediaTrackConstraints =
  {
    facingMode: 'user',
  };

export function resolveMatrixCameraVideoConstraints(): MediaTrackConstraints {
  return isIOSTouchDevice()
    ? IOS_TOUCH_CAMERA_CAPTURE_VIDEO_CONSTRAINTS
    : MATRIX_CAMERA_CAPTURE_VIDEO_CONSTRAINTS;
}

type MediaHandlerWithConstraints = {
  getUserMediaContraints?: (
    audio: boolean,
    video: boolean,
    exactDeviceId: boolean,
  ) => MediaStreamConstraints;
};

type MatrixClientWithMediaHandler = {
  getMediaHandler?: () => unknown;
};

export function mergeMatrixCameraVideoConstraints(
  baseVideo: MediaTrackConstraints,
): MediaTrackConstraints {
  const target = resolveMatrixCameraVideoConstraints();
  return {
    ...baseVideo,
    ...target,
    deviceId: baseVideo.deviceId,
  };
}

/**
 * Patch Matrix camera capture constraints for the duration of a group call session.
 */
export function installMatrixCameraCaptureConstraints(
  client: MatrixClientWithMediaHandler | null | undefined,
): () => void {
  const handler = client?.getMediaHandler?.() as
    | MediaHandlerWithConstraints
    | undefined;
  if (!handler?.getUserMediaContraints) {
    return () => undefined;
  }

  const original = handler.getUserMediaContraints.bind(handler);
  handler.getUserMediaContraints = (audio, video, exactDeviceId) => {
    const constraints = original(audio, video, exactDeviceId);
    if (!video) return constraints;
    if (constraints.video === true || constraints.video == null) {
      return {
        ...constraints,
        video: { ...resolveMatrixCameraVideoConstraints() },
      };
    }
    if (typeof constraints.video === 'object') {
      return {
        ...constraints,
        video: mergeMatrixCameraVideoConstraints(constraints.video),
      };
    }
    return constraints;
  };

  return () => {
    handler.getUserMediaContraints = original;
  };
}
