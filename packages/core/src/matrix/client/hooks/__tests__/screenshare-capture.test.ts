import { describe, expect, it, vi } from 'vitest';
import {
  MATRIX_SCREENSHARE_CAPTURE_OPTS,
  bindScreenshareStreamStopHandlers,
  clearOrphanedMatrixScreenshareStreams,
  screenshareStreamHasTabAudio,
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
