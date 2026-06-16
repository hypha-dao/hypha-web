import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveMatrixCameraVideoConstraints } from '../call-video-capture-constraints';
import {
  isLocalCameraPermissionDenied,
  requestLocalCameraAccess,
} from '../call-camera-access';

const originalPermissions = navigator.permissions;

afterEach(() => {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: originalPermissions,
  });
});

describe('isLocalCameraPermissionDenied', () => {
  it('returns true when the Permissions API reports denied', async () => {
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: 'denied' }),
      },
    });
    await expect(isLocalCameraPermissionDenied()).resolves.toBe(true);
  });

  it('returns false when permission is granted or prompt', async () => {
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi
          .fn()
          .mockResolvedValueOnce({ state: 'granted' })
          .mockResolvedValueOnce({ state: 'prompt' }),
      },
    });
    await expect(isLocalCameraPermissionDenied()).resolves.toBe(false);
    await expect(isLocalCameraPermissionDenied()).resolves.toBe(false);
  });
});

describe('requestLocalCameraAccess', () => {
  it('returns unavailable when getUserMedia is missing', async () => {
    const original = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });
    await expect(requestLocalCameraAccess()).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: original,
    });
  });

  it('stops acquired tracks after a successful prompt', async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop }],
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    await expect(requestLocalCameraAccess()).resolves.toEqual({ ok: true });
    expect(getUserMedia).toHaveBeenCalledWith({
      video: resolveMatrixCameraVideoConstraints(),
      audio: false,
    });
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
