import { describe, expect, it } from 'vitest';
import {
  MATRIX_SCREENSHARE_CAPTURE_OPTS,
  screenshareStreamHasTabAudio,
} from '../screenshare-capture';

describe('screenshare capture opts', () => {
  it('requests display media audio when supported', () => {
    expect(MATRIX_SCREENSHARE_CAPTURE_OPTS).toEqual({
      audio: true,
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
    } as MediaStream;
    expect(screenshareStreamHasTabAudio(stream)).toBe(false);
  });
});
