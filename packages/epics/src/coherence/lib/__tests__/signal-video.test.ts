import { describe, expect, it } from 'vitest';
import {
  resolveSignalVideo,
  signalVideoPoster,
  vimeoPosterId,
} from '../../utils/signal-video';

describe('resolveSignalVideo', () => {
  it('embeds a youtube watch link', () => {
    expect(
      resolveSignalVideo('https://www.youtube.com/watch?v=abc123XYZ_0'),
    ).toEqual({
      kind: 'youtube',
      src: 'https://www.youtube-nocookie.com/embed/abc123XYZ_0',
    });
  });

  it('embeds a vimeo link', () => {
    expect(resolveSignalVideo('https://vimeo.com/1231830761')).toEqual({
      kind: 'vimeo',
      src: 'https://player.vimeo.com/video/1231830761',
    });
  });

  it('plays a direct video file', () => {
    expect(resolveSignalVideo('https://cdn.example.com/clip.mp4')).toEqual({
      kind: 'file',
      src: 'https://cdn.example.com/clip.mp4',
    });
  });

  it('uses the youtube thumbnail when the card has no image', () => {
    const video = resolveSignalVideo(
      'https://www.youtube.com/watch?v=abc123XYZ_0',
    );
    expect(video && signalVideoPoster(video)).toBe(
      'https://i.ytimg.com/vi/abc123XYZ_0/hqdefault.jpg',
    );
  });

  it('reads a vimeo id for its thumbnail', () => {
    const video = resolveSignalVideo('https://vimeo.com/1231830761');
    expect(video && vimeoPosterId(video)).toBe('1231830761');
    expect(video && signalVideoPoster(video)).toBeNull();
  });

  it('ignores a page that is not a video', () => {
    expect(resolveSignalVideo('https://example.com/notes')).toBeNull();
    expect(resolveSignalVideo('https://notyoutube.com/watch?v=abc')).toBeNull();
    expect(resolveSignalVideo('https://notvimeo.com/123456789')).toBeNull();
  });
});
