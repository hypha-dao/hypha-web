import { describe, expect, it, vi } from 'vitest';
import {
  WEBKIT_CAMERA_CAPTURE_VIDEO_CONSTRAINTS,
  MATRIX_CAMERA_CAPTURE_VIDEO_CONSTRAINTS,
  installMatrixCameraCaptureConstraints,
  isMobileCameraDevice,
  liveKitCameraCaptureDefaults,
  mergeMatrixCameraVideoConstraints,
  resolveMatrixCameraVideoConstraints,
} from '../call-video-capture-constraints';

describe('MATRIX_CAMERA_CAPTURE_VIDEO_CONSTRAINTS', () => {
  it('requests 720p ideal capture with facingMode user', () => {
    expect(MATRIX_CAMERA_CAPTURE_VIDEO_CONSTRAINTS).toEqual({
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 24, max: 30 },
      facingMode: 'user',
    });
  });
});

describe('resolveMatrixCameraVideoConstraints', () => {
  it('uses minimal facingMode constraints on iPad', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    });
    expect(resolveMatrixCameraVideoConstraints()).toEqual(
      WEBKIT_CAMERA_CAPTURE_VIDEO_CONSTRAINTS,
    );
    vi.unstubAllGlobals();
  });

  it('uses minimal facingMode constraints on macOS Safari', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });
    expect(resolveMatrixCameraVideoConstraints()).toEqual(
      WEBKIT_CAMERA_CAPTURE_VIDEO_CONSTRAINTS,
    );
    vi.unstubAllGlobals();
  });
});

describe('mergeMatrixCameraVideoConstraints', () => {
  it('preserves deviceId while raising resolution targets', () => {
    expect(
      mergeMatrixCameraVideoConstraints({
        width: { ideal: 640 },
        height: { ideal: 360 },
        deviceId: { ideal: 'front-cam' },
      }),
    ).toEqual({
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 24, max: 30 },
      facingMode: 'user',
      deviceId: { ideal: 'front-cam' },
    });
  });
});

describe('installMatrixCameraCaptureConstraints', () => {
  it('patches getUserMediaContraints for the session and restores on cleanup', () => {
    const handler = {
      getUserMediaContraints: vi.fn(
        (audio: boolean, video: boolean, _exactDeviceId?: boolean) => ({
          audio: audio ? {} : false,
          video: video
            ? { width: { ideal: 640 }, height: { ideal: 360 } }
            : false,
        }),
      ),
    };
    const client = { getMediaHandler: () => handler };

    const cleanup = installMatrixCameraCaptureConstraints(client);
    expect(handler.getUserMediaContraints(true, true, false).video).toEqual(
      MATRIX_CAMERA_CAPTURE_VIDEO_CONSTRAINTS,
    );
    expect(handler.getUserMediaContraints(true, false, false).video).toBe(
      false,
    );

    cleanup();
    expect(handler.getUserMediaContraints(true, true, false).video).toEqual({
      width: { ideal: 640 },
      height: { ideal: 360 },
    });
  });
});

describe('liveKitCameraCaptureDefaults', () => {
  it('asks for the front camera on phones and tablets', () => {
    expect(liveKitCameraCaptureDefaults(true)).toEqual({ facingMode: 'user' });
  });

  it('leaves desktop untouched', () => {
    expect(liveKitCameraCaptureDefaults(false)).toEqual({});
  });
});

describe('isMobileCameraDevice', () => {
  it('detects phones and tablets by user agent', () => {
    expect(
      isMobileCameraDevice(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36',
      ),
    ).toBe(true);
    expect(
      isMobileCameraDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
      ),
    ).toBe(true);
  });

  it('is false on desktop', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
      platform: 'Win32',
      maxTouchPoints: 0,
    });
    expect(isMobileCameraDevice()).toBe(false);
    vi.unstubAllGlobals();
  });
});
