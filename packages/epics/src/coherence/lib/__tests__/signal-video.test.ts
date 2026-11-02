import { describe, expect, it } from 'vitest';
import {
  resolveSignalVideo,
  signalVideoLinkHost,
  signalVideoLinkProblem,
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

describe('signalVideoLinkProblem', () => {
  const options = {
    mediaSources: ["'self'", 'https://*.ufs.sh', 'https://utfs.io'],
    selfOrigin: 'https://app.hypha.earth',
  };

  it('accepts an empty field, YouTube and Vimeo links', () => {
    expect(signalVideoLinkProblem('', options)).toBeNull();
    expect(
      signalVideoLinkProblem('https://youtu.be/abc123XYZ_0', options),
    ).toBeNull();
    expect(
      signalVideoLinkProblem('https://vimeo.com/1231830761', options),
    ).toBeNull();
  });

  it('accepts a video file the media-src policy allows', () => {
    expect(
      signalVideoLinkProblem('https://abc.ufs.sh/f/clip.mp4', options),
    ).toBeNull();
    expect(
      signalVideoLinkProblem('https://app.hypha.earth/clip.webm', options),
    ).toBeNull();
  });

  it('blocks a video file from a host the policy does not allow', () => {
    expect(
      signalVideoLinkProblem('https://cdn.example.com/clip.mp4', options),
    ).toBe('blocked');
    expect(signalVideoLinkHost('https://cdn.example.com/clip.mp4')).toBe(
      'cdn.example.com',
    );
  });

  it('rejects a link longer than 2000 characters', () => {
    const url = `https://youtu.be/${'a'.repeat(1990)}`;
    expect(url.length).toBeGreaterThan(2000);
    expect(signalVideoLinkProblem(url, options)).toBe('too-long');
    expect(
      signalVideoLinkProblem(
        `${'https://youtu.be/abc123XYZ_0'}${' '.repeat(2000)}`,
        options,
      ),
    ).toBeNull();
  });

  it('rejects a link that is not a video at all', () => {
    expect(
      signalVideoLinkProblem('https://example.com/watch-this', options),
    ).toBe('unsupported');
    expect(signalVideoLinkProblem('not a link', options)).toBe('unsupported');
  });
});
