// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  hardenCallVideoAgainstNativePictureInPicture,
  registerCallPlaybackElement,
  resetCallPlaybackRegistryForTests,
} from '../call-playback-registry';

describe('call-playback-registry native PiP guard', () => {
  beforeEach(() => {
    resetCallPlaybackRegistryForTests();
  });

  it('sets disablePictureInPicture on registered call video elements', () => {
    const video = document.createElement('video');
    const release = registerCallPlaybackElement(video);
    expect(video.disablePictureInPicture).toBe(true);
    expect(video.getAttribute('disablePictureInPicture')).toBe('');
    release();
  });

  it('exits native picture-in-picture if the browser enters it anyway', () => {
    const video = document.createElement('video');
    const exitPictureInPicture = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'exitPictureInPicture', {
      configurable: true,
      value: exitPictureInPicture,
    });

    const release = hardenCallVideoAgainstNativePictureInPicture(video);
    video.dispatchEvent(new Event('enterpictureinpicture'));

    expect(exitPictureInPicture).toHaveBeenCalledTimes(1);
    release();
  });

  it('ignores non-video media elements', () => {
    const audio = document.createElement('audio');
    const release = registerCallPlaybackElement(audio);
    expect(audio.getAttribute('disablePictureInPicture')).toBeNull();
    release();
  });
});
