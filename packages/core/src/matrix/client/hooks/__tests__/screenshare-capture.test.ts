import { describe, expect, it, vi } from 'vitest';
import {
  MATRIX_SCREENSHARE_CAPTURE_OPTS,
  bindScreenshareStreamStopHandlers,
  buildDisplayMediaConstraints,
  clearOrphanedMatrixScreenshareStreams,
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
});

describe('buildDisplayMediaConstraints', () => {
  it('requests tab and system audio hints for Chrome display media', () => {
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

  it('respects audio: false in opts', () => {
    expect(buildDisplayMediaConstraints({ audio: false })).toEqual({
      video: true,
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
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
