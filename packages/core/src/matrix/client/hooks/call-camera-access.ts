import { resolveMatrixCameraVideoConstraints } from './call-video-capture-constraints';
import { isPermissionLikeGroupCallError } from './space-group-call-utils';

export type LocalCameraAccessResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'permission_denied' | 'failed' };

/**
 * Prompt for camera access so the browser registers the site permission and
 * Matrix can acquire a fresh video track afterward.
 */
export async function requestLocalCameraAccess(): Promise<LocalCameraAccessResult> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return { ok: false, reason: 'unavailable' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: resolveMatrixCameraVideoConstraints(),
      audio: false,
    });
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return { ok: true };
  } catch (error) {
    if (isPermissionLikeGroupCallError(error)) {
      return { ok: false, reason: 'permission_denied' };
    }
    return { ok: false, reason: 'failed' };
  }
}
