/**
 * Camera choice in calls (#2789): the member's chosen camera, how it is stored on this device,
 * how it is matched against the cameras present now, and which camera to fall back to. Pure
 * logic only; the switching itself is in `use-space-group-call.ts` (livekit
 * `switchActiveDevice`).
 */

import { type LocalVideoTrack, TrackEvent } from 'livekit-client';

/** A camera as the picker shows it. `label` is empty until camera permission is granted. */
export type CallCameraDevice = {
  deviceId: string;
  label: string;
};

/** The stored choice: the id, and the label to find the camera again if the browser renews ids. */
export type SavedCallCamera = {
  deviceId: string;
  label: string;
};

export const CALL_CAMERA_DEVICE_STORAGE_KEY =
  'hypha-group-call-camera-device-v1';

type MediaDeviceInfoLike = Pick<MediaDeviceInfo, 'deviceId' | 'kind' | 'label'>;

/** Chrome appends the USB vendor:product id to labels, e.g. "HD Webcam C270 (046d:0825)". */
const USB_ID_SUFFIX = /\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i;

export function cleanCallCameraLabel(label: string): string {
  return label.replace(USB_ID_SUFFIX, '').trim();
}

/**
 * The cameras from `enumerateDevices()`. Entries without an id are dropped: before permission
 * browsers list placeholders that cannot be selected.
 */
export function listCallCameras(
  devices: readonly MediaDeviceInfoLike[],
): CallCameraDevice[] {
  const seen = new Set<string>();
  const cameras: CallCameraDevice[] = [];
  for (const device of devices) {
    if (device.kind !== 'videoinput' || !device.deviceId) continue;
    if (seen.has(device.deviceId)) continue;
    seen.add(device.deviceId);
    cameras.push({
      deviceId: device.deviceId,
      label: cleanCallCameraLabel(device.label ?? ''),
    });
  }
  return cameras;
}

/** Same cameras in the same order with the same labels (avoids needless re-renders). */
export function sameCallCameras(
  a: readonly CallCameraDevice[],
  b: readonly CallCameraDevice[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (camera, index) =>
        camera.deviceId === b[index]?.deviceId &&
        camera.label === b[index]?.label,
    )
  );
}

/**
 * The present camera matching the stored choice: by id, else by label when exactly one camera
 * has it (ids change when site data is cleared). Null means the browser default.
 */
export function resolvePreferredCamera(
  cameras: readonly CallCameraDevice[],
  saved: SavedCallCamera | null,
): string | null {
  if (!saved) return null;
  if (cameras.some((camera) => camera.deviceId === saved.deviceId)) {
    return saved.deviceId;
  }
  const label = saved.label.trim();
  if (!label) return null;
  const sameLabel = cameras.filter((camera) => camera.label === label);
  return sameLabel.length === 1 ? sameLabel[0]!.deviceId : null;
}

/**
 * The camera a new capture asks for. Before camera permission the list has no ids, so the stored
 * id is used as it is (livekit tries it exactly, then as a preference).
 */
export function preferredCameraForCapture(
  cameras: readonly CallCameraDevice[],
  saved: SavedCallCamera | null,
): string | null {
  if (cameras.length === 0) return saved?.deviceId ?? null;
  return resolvePreferredCamera(cameras, saved);
}

/** The device id inside a `deviceId` constraint (string, `{ exact }` or `{ ideal }`). */
export function constraintDeviceId(
  constraint: ConstrainDOMString | undefined,
): string | null {
  if (!constraint) return null;
  if (typeof constraint === 'string') return constraint || null;
  if (Array.isArray(constraint)) return constraint[0] ?? null;
  const { exact, ideal } = constraint as ConstrainDOMStringParameters;
  const value = exact ?? ideal;
  if (typeof value === 'string') return value || null;
  return Array.isArray(value) ? value[0] ?? null : null;
}

/**
 * The camera to use when `lostDeviceId` went away: the stored choice when present, else the
 * first other camera. Null when no camera is left.
 */
export function pickFallbackCamera(
  cameras: readonly CallCameraDevice[],
  lostDeviceId: string | null,
  saved: SavedCallCamera | null,
): string | null {
  const others = cameras.filter((camera) => camera.deviceId !== lostDeviceId);
  const preferred = resolvePreferredCamera(others, saved);
  return preferred ?? others[0]?.deviceId ?? null;
}

export function parseSavedCallCamera(
  raw: string | null | undefined,
): SavedCallCamera | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SavedCallCamera> | null;
    if (
      !parsed ||
      typeof parsed.deviceId !== 'string' ||
      !parsed.deviceId.trim()
    ) {
      return null;
    }
    return {
      deviceId: parsed.deviceId,
      label: typeof parsed.label === 'string' ? parsed.label : '',
    };
  } catch {
    return null;
  }
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSavedCallCamera(
  storage: StorageLike | null = defaultStorage(),
): SavedCallCamera | null {
  if (!storage) return null;
  try {
    return parseSavedCallCamera(
      storage.getItem(CALL_CAMERA_DEVICE_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

/** Stores the choice; null clears it (the browser default again). */
export function persistSavedCallCamera(
  camera: SavedCallCamera | null,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    if (camera) {
      storage.setItem(CALL_CAMERA_DEVICE_STORAGE_KEY, JSON.stringify(camera));
    } else {
      storage.removeItem(CALL_CAMERA_DEVICE_STORAGE_KEY);
    }
  } catch {
    // ignore persistence write failures (private mode, quota)
  }
}

/** A message about the camera after a failed switch or an unplugged camera. */
export type CallCameraDeviceNotice =
  /** The picked camera could not be opened (busy in another app, gone); the previous one is back. */
  | { kind: 'switch_failed'; label: string }
  /** The picked camera could not be opened and neither could the previous one: camera off. */
  | { kind: 'switch_failed_off'; label: string }
  /** The camera in use went away; the call now uses `label`. */
  | { kind: 'disconnected_switched'; label: string }
  /** The camera in use went away and no other camera works: camera off. */
  | { kind: 'disconnected_off' };

type CameraTrackEvents = Pick<LocalVideoTrack, 'isMuted' | 'on' | 'off'>;

/**
 * After the camera capture ended (unplugged), livekit restarts the track on its own (the old
 * constraints) and mutes it when that fails (`LocalParticipant.handleTrackEnded`). Resolves with
 * what happened, or `timeout`.
 */
export function waitForCameraRecovery(
  track: CameraTrackEvents,
  timeoutMs: number,
): Promise<'restarted' | 'muted' | 'timeout'> {
  return new Promise((resolve) => {
    let settled = false;
    const onRestarted = () => done('restarted');
    const onMuted = () => done('muted');
    const timer = setTimeout(() => done('timeout'), timeoutMs);
    function done(outcome: 'restarted' | 'muted' | 'timeout') {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      track.off(TrackEvent.Restarted, onRestarted);
      track.off(TrackEvent.Muted, onMuted);
      resolve(outcome);
    }
    track.on(TrackEvent.Restarted, onRestarted);
    track.on(TrackEvent.Muted, onMuted);
    if (track.isMuted) done('muted');
  });
}
