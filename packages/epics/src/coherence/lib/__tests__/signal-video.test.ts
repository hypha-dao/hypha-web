import { describe, expect, it } from 'vitest';
import { resolveSignalVideo } from '../../utils/signal-video';

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
    expect(resolveSignalVideo('https://vimeo.com/123456789')).toEqual({
      kind: 'vimeo',
      src: 'https://player.vimeo.com/video/123456789',
    });
  });

  it('plays a direct video file', () => {
    expect(resolveSignalVideo('https://cdn.example.com/clip.mp4')).toEqual({
      kind: 'file',
      src: 'https://cdn.example.com/clip.mp4',
    });
  });

  it('ignores a page that is not a video', () => {
    expect(resolveSignalVideo('https://example.com/notes')).toBeNull();
    expect(resolveSignalVideo('https://notyoutube.com/watch?v=abc')).toBeNull();
    expect(resolveSignalVideo('https://notvimeo.com/123456789')).toBeNull();
  });
});
