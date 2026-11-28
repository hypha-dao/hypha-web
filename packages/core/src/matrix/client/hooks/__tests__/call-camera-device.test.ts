import { EventEmitter } from 'events';
import { TrackEvent } from 'livekit-client';
import { describe, expect, it, vi } from 'vitest';
import {
  CALL_CAMERA_DEVICE_STORAGE_KEY,
  cleanCallCameraLabel,
  constraintDeviceId,
  listCallCameras,
  parseSavedCallCamera,
  persistSavedCallCamera,
  pickFallbackCamera,
  preferredCameraForCapture,
  readSavedCallCamera,
  resolvePreferredCamera,
  sameCallCameras,
  waitForCameraRecovery,
} from '../call-camera-device';

const device = (
  deviceId: string,
  label: string,
  kind: MediaDeviceKind = 'videoinput',
) => ({ deviceId, label, kind });

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    data,
  };
}

describe('listCallCameras', () => {
  it('keeps cameras only, without placeholders or duplicates, labels cleaned', () => {
    expect(
      listCallCameras([
        device('mic', 'Mic', 'audioinput'),
        device('', ''),
        device('a', 'HD Webcam C270 (046d:0825)'),
        device('a', 'HD Webcam C270 (046d:0825)'),
        device('b', ''),
      ]),
    ).toEqual([
      { deviceId: 'a', label: 'HD Webcam C270' },
      { deviceId: 'b', label: '' },
    ]);
  });
});

describe('cleanCallCameraLabel', () => {
  it('leaves labels without a USB id as they are', () => {
    expect(cleanCallCameraLabel(' OBS Virtual Camera ')).toBe(
      'OBS Virtual Camera',
    );
  });
});

describe('sameCallCameras', () => {
  it('compares ids, labels and order', () => {
    const a = [{ deviceId: 'a', label: 'A' }];
    expect(sameCallCameras(a, [{ deviceId: 'a', label: 'A' }])).toBe(true);
    expect(sameCallCameras(a, [{ deviceId: 'a', label: 'B' }])).toBe(false);
    expect(sameCallCameras(a, [])).toBe(false);
  });
});

describe('resolvePreferredCamera', () => {
  const cameras = [
    { deviceId: 'a', label: 'Front' },
    { deviceId: 'b', label: 'OBS' },
  ];

  it('is the default (null) without a stored choice', () => {
    expect(resolvePreferredCamera(cameras, null)).toBeNull();
  });

  it('matches by id', () => {
    expect(resolvePreferredCamera(cameras, { deviceId: 'b', label: 'x' })).toBe(
      'b',
    );
  });

  it('matches a renewed id by a unique label', () => {
    expect(
      resolvePreferredCamera(cameras, { deviceId: 'old', label: 'OBS' }),
    ).toBe('b');
  });

  it('is the default when the camera is gone or the label is ambiguous', () => {
    expect(
      resolvePreferredCamera(cameras, { deviceId: 'old', label: 'Gone' }),
    ).toBeNull();
    expect(
      resolvePreferredCamera([...cameras, { deviceId: 'c', label: 'OBS' }], {
        deviceId: 'old',
        label: 'OBS',
      }),
    ).toBeNull();
    expect(
      resolvePreferredCamera(cameras, { deviceId: 'old', label: '' }),
    ).toBeNull();
  });
});

describe('pickFallbackCamera', () => {
  const cameras = [
    { deviceId: 'a', label: 'A' },
    { deviceId: 'b', label: 'B' },
    { deviceId: 'c', label: 'C' },
  ];

  it('prefers the stored choice when it is not the lost camera', () => {
    expect(
      pickFallbackCamera(cameras, 'a', { deviceId: 'c', label: 'C' }),
    ).toBe('c');
  });

  it('takes the first other camera otherwise', () => {
    expect(
      pickFallbackCamera(cameras, 'a', { deviceId: 'a', label: 'A' }),
    ).toBe('b');
    expect(pickFallbackCamera(cameras, 'a', null)).toBe('b');
  });

  it('is null when no other camera is left', () => {
    expect(pickFallbackCamera([{ deviceId: 'a', label: 'A' }], 'a', null)).toBe(
      null,
    );
    expect(pickFallbackCamera([], null, null)).toBeNull();
  });
});

describe('stored choice', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage();
    persistSavedCallCamera({ deviceId: 'a', label: 'A' }, storage);
    expect(storage.data.get(CALL_CAMERA_DEVICE_STORAGE_KEY)).toBeTruthy();
    expect(readSavedCallCamera(storage)).toEqual({ deviceId: 'a', label: 'A' });
    persistSavedCallCamera(null, storage);
    expect(readSavedCallCamera(storage)).toBeNull();
  });

  it('reads nothing from bad or missing values', () => {
    expect(parseSavedCallCamera(null)).toBeNull();
    expect(parseSavedCallCamera('not json')).toBeNull();
    expect(parseSavedCallCamera('{"deviceId":""}')).toBeNull();
    expect(parseSavedCallCamera('{"deviceId":"a"}')).toEqual({
      deviceId: 'a',
      label: '',
    });
    expect(readSavedCallCamera(null)).toBeNull();
  });

  it('never throws when storage fails', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readSavedCallCamera(broken)).toBeNull();
    expect(() =>
      persistSavedCallCamera({ deviceId: 'a', label: '' }, broken),
    ).not.toThrow();
    expect(() => persistSavedCallCamera(null, broken)).not.toThrow();
  });
});

describe('preferredCameraForCapture', () => {
  it('uses the stored id as it is before permission (no ids listed)', () => {
    expect(preferredCameraForCapture([], { deviceId: 'a', label: 'A' })).toBe(
      'a',
    );
    expect(preferredCameraForCapture([], null)).toBeNull();
  });

  it('matches against the list once ids are known', () => {
    expect(
      preferredCameraForCapture([{ deviceId: 'b', label: 'B' }], {
        deviceId: 'a',
        label: 'A',
      }),
    ).toBeNull();
  });
});

describe('constraintDeviceId', () => {
  it('reads every constraint shape', () => {
    expect(constraintDeviceId(undefined)).toBeNull();
    expect(constraintDeviceId('')).toBeNull();
    expect(constraintDeviceId('a')).toBe('a');
    expect(constraintDeviceId(['a', 'b'])).toBe('a');
    expect(constraintDeviceId({ exact: 'a' })).toBe('a');
    expect(constraintDeviceId({ ideal: 'b' })).toBe('b');
    expect(constraintDeviceId({ exact: ['c'] })).toBe('c');
    expect(constraintDeviceId({})).toBeNull();
  });
});

describe('waitForCameraRecovery', () => {
  function fakeTrack(isMuted = false) {
    const emitter = new EventEmitter();
    return Object.assign(emitter, { isMuted }) as EventEmitter &
      Parameters<typeof waitForCameraRecovery>[0];
  }

  it('reports a restart and removes its listeners', async () => {
    const track = fakeTrack();
    const outcome = waitForCameraRecovery(track, 1000);
    track.emit(TrackEvent.Restarted);
    await expect(outcome).resolves.toBe('restarted');
    expect(track.listenerCount(TrackEvent.Muted)).toBe(0);
  });

  it('reports a mute, also one that already happened', async () => {
    const track = fakeTrack();
    const outcome = waitForCameraRecovery(track, 1000);
    track.emit(TrackEvent.Muted);
    await expect(outcome).resolves.toBe('muted');
    await expect(waitForCameraRecovery(fakeTrack(true), 1000)).resolves.toBe(
      'muted',
    );
  });

  it('times out', async () => {
    vi.useFakeTimers();
    try {
      const track = fakeTrack();
      const outcome = waitForCameraRecovery(track, 500);
      vi.advanceTimersByTime(500);
      await expect(outcome).resolves.toBe('timeout');
      expect(track.listenerCount(TrackEvent.Restarted)).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
