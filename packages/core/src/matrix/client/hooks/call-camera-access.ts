import { resolveMatrixCameraVideoConstraints } from './call-video-capture-constraints';
import { isPermissionLikeGroupCallError } from './space-group-call-utils';

export type LocalCameraAccessResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'permission_denied' | 'failed' };

/**
 * Read camera permission without opening a second getUserMedia stream.
 * When state is `prompt` or `granted`, Matrix `enter()` should be the only
 * capture prompt during join.
 */
export async function isLocalCameraPermissionDenied(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  try {
    const permissions = navigator.permissions;
    if (!permissions?.query) return false;
    const status = await permissions.query({
      name: 'camera' as PermissionName,
    });
    return status.state === 'denied';
  } catch {
    return false;
  }
}

/**
 * Prompt for camera access when the user turns the camera on mid-call.
 * Avoid calling this before `GroupCall.enter()` — it causes a duplicate prompt.
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
