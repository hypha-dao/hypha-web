import { describe, expect, it, vi } from 'vitest';
import { requestLocalCameraAccess } from '../call-camera-access';

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
      video: { facingMode: 'user' },
      audio: false,
    });
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
