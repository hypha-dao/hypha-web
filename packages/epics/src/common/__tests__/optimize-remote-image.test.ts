import { afterEach, describe, expect, it } from 'vitest';

import {
  isLikelyGifSrc,
  shouldOptimizeRemoteImage,
} from '../optimize-remote-image';

describe('shouldOptimizeRemoteImage', () => {
  const originalHosts = process.env.NEXT_PUBLIC_IMAGE_HOSTS;

  afterEach(() => {
    if (originalHosts === undefined) {
      delete process.env.NEXT_PUBLIC_IMAGE_HOSTS;
    } else {
      process.env.NEXT_PUBLIC_IMAGE_HOSTS = originalHosts;
    }
  });

  it('optimizes UploadThing CDN originals so avatars are not full-size', () => {
    expect(
      shouldOptimizeRemoteImage('https://bovzk9ehhu.ufs.sh/f/abc-avatar.png'),
    ).toBe(true);
    expect(shouldOptimizeRemoteImage('https://utfs.io/f/abc')).toBe(true);
    expect(
      shouldOptimizeRemoteImage('https://files.uploadthing.com/f/abc'),
    ).toBe(true);
  });

  it('leaves data and blob URLs unoptimized', () => {
    expect(shouldOptimizeRemoteImage('data:image/png;base64,abc')).toBe(false);
    expect(shouldOptimizeRemoteImage('blob:https://hypha.earth/1')).toBe(false);
  });

  it('optimizes local and relative paths', () => {
    expect(shouldOptimizeRemoteImage('/placeholder.png')).toBe(true);
    expect(shouldOptimizeRemoteImage('placeholder.png')).toBe(true);
  });

  it('optimizes hosts listed in NEXT_PUBLIC_IMAGE_HOSTS', () => {
    process.env.NEXT_PUBLIC_IMAGE_HOSTS = 'cdn.example.org, images.hypha.earth';
    expect(shouldOptimizeRemoteImage('https://cdn.example.org/a.png')).toBe(
      true,
    );
    expect(
      shouldOptimizeRemoteImage('https://images.hypha.earth/people/1.png'),
    ).toBe(true);
  });

  it('does not send unknown remotes through the optimizer', () => {
    process.env.NEXT_PUBLIC_IMAGE_HOSTS = '';
    expect(shouldOptimizeRemoteImage('https://evil.example/a.png')).toBe(false);
  });

  it('leaves animated GIFs unoptimized so the optimizer does not fetch them twice', () => {
    expect(
      isLikelyGifSrc('https://bovzk9ehhu.ufs.sh/f/community-logo.gif'),
    ).toBe(true);
    expect(
      shouldOptimizeRemoteImage(
        'https://bovzk9ehhu.ufs.sh/f/community-logo.gif',
      ),
    ).toBe(false);
    expect(
      shouldOptimizeRemoteImage(
        'https://bovzk9ehhu.ufs.sh/f/community-logo.GIF?w=1',
      ),
    ).toBe(false);
  });
});
