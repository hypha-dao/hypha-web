import { describe, expect, it, vi } from 'vitest';
import {
  MATRIX_SCREENSHARE_CAPTURE_OPTS,
  bindScreenshareStreamStopHandlers,
  buildDisplayMediaConstraints,
  clearOrphanedMatrixScreenshareStreams,
  isIOSTouchDevice,
  resolveMatrixScreenshareCaptureOpts,
  screenshareStreamHasTabAudio,
  withEnhancedScreenshareCapture,
} from '../screenshare-capture';

describe('screenshare capture opts', () => {
  it('requests display media audio when supported', () => {
    expect(MATRIX_SCREENSHARE_CAPTURE_OPTS).toEqual({
      audio: {
        suppressLocalAudioPlayback: false,
      },
    });
  });

  it('disables display audio on iOS touch devices', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    });
    expect(resolveMatrixScreenshareCaptureOpts()).toEqual({ audio: false });
    expect(isIOSTouchDevice()).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe('buildDisplayMediaConstraints', () => {
  it('requests tab capture hints by default', () => {
    expect(buildDisplayMediaConstraints()).toEqual({
      video: true,
      audio: {
        suppressLocalAudioPlayback: false,
      },
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      systemAudio: 'include',
    });
  });

  it('limits the picker to windows when sharing a window', () => {
    expect(
      buildDisplayMediaConstraints(MATRIX_SCREENSHARE_CAPTURE_OPTS, 'window'),
    ).toEqual({
      video: true,
      audio: {
        suppressLocalAudioPlayback: false,
      },
      preferCurrentTab: false,
      selfBrowserSurface: 'exclude',
      monitorTypeSurfaces: 'exclude',
      systemAudio: 'include',
    });
  });

  it('includes monitor surfaces for entire-screen share', () => {
    expect(
      buildDisplayMediaConstraints(MATRIX_SCREENSHARE_CAPTURE_OPTS, 'monitor'),
    ).toEqual({
      video: true,
      audio: {
        suppressLocalAudioPlayback: false,
      },
      preferCurrentTab: false,
      selfBrowserSurface: 'exclude',
      monitorTypeSurfaces: 'include',
      systemAudio: 'include',
    });
  });

  it('uses minimal video-only constraints on iOS touch devices', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    });
    expect(buildDisplayMediaConstraints()).toEqual({
      video: true,
      audio: false,
    });
    vi.unstubAllGlobals();
  });

  it('respects audio: false in opts', () => {
    expect(buildDisplayMediaConstraints({ audio: false }, 'window')).toEqual({
      video: true,
      audio: false,
      preferCurrentTab: false,
      selfBrowserSurface: 'exclude',
      monitorTypeSurfaces: 'exclude',
      systemAudio: 'include',
    });
  });
});

describe('withEnhancedScreenshareCapture', () => {
  it('patches getScreenshareContraints for the duration of run', async () => {
    const handler = {
      getScreenshareContraints: vi.fn(() => ({ video: true, audio: false })),
    };
    const client = { getMediaHandler: () => handler };

    await withEnhancedScreenshareCapture(client, async () => {
      expect(handler.getScreenshareContraints({ audio: true })).toEqual(
        buildDisplayMediaConstraints({ audio: true }),
      );
    });

    expect(handler.getScreenshareContraints({ audio: true })).toEqual({
      video: true,
      audio: false,
    });
  });
});

describe('screenshareStreamHasTabAudio', () => {
  it('returns true when the stream has audio tracks', () => {
    const stream = {
      getAudioTracks: () => [{}],
    } as MediaStream;
    expect(screenshareStreamHasTabAudio(stream)).toBe(true);
  });

  it('returns false when the stream has no audio tracks', () => {
    const stream = {
      getAudioTracks: () => [],
    } as unknown as MediaStream;
    expect(screenshareStreamHasTabAudio(stream)).toBe(false);
  });
});

describe('clearOrphanedMatrixScreenshareStreams', () => {
  it('stops cached streams via the media handler', () => {
    const stream = {
      getTracks: () => [],
    } as unknown as MediaStream;
    const stopScreensharingStream = vi.fn();
    clearOrphanedMatrixScreenshareStreams({
      getMediaHandler: () => ({
        screensharingStreams: [stream],
        stopScreensharingStream,
      }),
    });
    expect(stopScreensharingStream).toHaveBeenCalledWith(stream);
  });
});

describe('bindScreenshareStreamStopHandlers', () => {
  it('invokes onStopped when a track ends', () => {
    const onStopped = vi.fn();
    const track = new EventTarget() as MediaStreamTrack;
    Object.defineProperty(track, 'readyState', { value: 'live' });
    const stream = {
      getTracks: () => [track],
    } as MediaStream;

    bindScreenshareStreamStopHandlers(stream, onStopped);
    track.dispatchEvent(new Event('ended'));
    expect(onStopped).toHaveBeenCalledTimes(1);
  });
});
