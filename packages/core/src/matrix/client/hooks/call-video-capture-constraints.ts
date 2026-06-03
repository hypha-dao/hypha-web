/**
 * Matrix `MediaHandler.getUserMediaContraints` defaults to 640×360 ideal.
 * Hypha patches it for the call session to request 720p capture (WCUX-QUALITY-1).
 */

export const MATRIX_CAMERA_CAPTURE_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
  frameRate: { ideal: 24, max: 30 },
  facingMode: 'user',
};

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
  return {
    ...baseVideo,
    ...MATRIX_CAMERA_CAPTURE_VIDEO_CONSTRAINTS,
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
        video: { ...MATRIX_CAMERA_CAPTURE_VIDEO_CONSTRAINTS },
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
