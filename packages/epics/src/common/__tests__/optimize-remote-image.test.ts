import { afterEach, describe, expect, it } from 'vitest';
import { imageConfigDefault } from 'next/dist/shared/lib/image-config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isLikelyGifSrc,
  isLikelySvgSrc,
  isNextImageOptimizationDisabled,
  NEXT_IMAGE_WIDTHS,
  parseConfiguredImageHosts,
  shouldOptimizeRemoteImage,
  snapToNextImageWidth,
  toCanvasSampleSrc,
  toNextImageOptimizerSrc,
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
    expect(shouldOptimizeRemoteImage('https://ufs.sh/f/abc')).toBe(true);
    expect(
      shouldOptimizeRemoteImage('https://files.uploadthing.com/f/abc'),
    ).toBe(true);
  });

  it('does not optimize bare uploadthing.com or http UploadThing URLs', () => {
    expect(shouldOptimizeRemoteImage('https://uploadthing.com/f/abc')).toBe(
      false,
    );
    expect(shouldOptimizeRemoteImage('http://utfs.io/f/abc')).toBe(false);
    expect(
      shouldOptimizeRemoteImage('http://bovzk9ehhu.ufs.sh/f/abc-avatar.png'),
    ).toBe(false);
  });

  it('leaves data and blob URLs unoptimized', () => {
    expect(shouldOptimizeRemoteImage('data:image/png;base64,abc')).toBe(false);
    expect(shouldOptimizeRemoteImage('blob:https://hypha.earth/1')).toBe(false);
  });

  it('optimizes only root-relative local paths', () => {
    expect(shouldOptimizeRemoteImage('/placeholder.png')).toBe(true);
    expect(shouldOptimizeRemoteImage('placeholder.png')).toBe(false);
    expect(shouldOptimizeRemoteImage('./placeholder.png')).toBe(false);
    expect(shouldOptimizeRemoteImage('//cdn.example.org/a.png')).toBe(false);
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

  it('parses NEXT_PUBLIC_IMAGE_HOSTS without requiring a space after commas', () => {
    process.env.NEXT_PUBLIC_IMAGE_HOSTS = 'cdn.example.org,images.hypha.earth';
    expect(shouldOptimizeRemoteImage('https://cdn.example.org/a.png')).toBe(
      true,
    );
    expect(
      shouldOptimizeRemoteImage('https://images.hypha.earth/people/1.png'),
    ).toBe(true);
  });

  it('lowercases mixed-case NEXT_PUBLIC_IMAGE_HOSTS to match next/image', () => {
    process.env.NEXT_PUBLIC_IMAGE_HOSTS = 'CDN.EXAMPLE.ORG';
    expect(parseConfiguredImageHosts()).toEqual(['cdn.example.org']);
    expect(shouldOptimizeRemoteImage('https://cdn.example.org/a.png')).toBe(
      true,
    );
  });

  it('requires https and an exact hostname for configured hosts', () => {
    process.env.NEXT_PUBLIC_IMAGE_HOSTS = 'cdn.example.org';
    expect(shouldOptimizeRemoteImage('http://cdn.example.org/a.png')).toBe(
      false,
    );
    expect(shouldOptimizeRemoteImage('https://img.cdn.example.org/a.png')).toBe(
      false,
    );
  });

  it('does not send unknown remotes through the optimizer', () => {
    process.env.NEXT_PUBLIC_IMAGE_HOSTS = '';
    expect(shouldOptimizeRemoteImage('https://evil.example/a.png')).toBe(false);
  });

  it('optimizes the leftover Ponta ecosystem PNG that has no file extension', () => {
    const pontaPng =
      'https://bovzk9ehhu.ufs.sh/f/6MiOwFUJuAcocp3uZG4AN0lxYkareI1GvqLDX2FV5jh8d4fo';
    expect(shouldOptimizeRemoteImage(pontaPng)).toBe(true);
    expect(toNextImageOptimizerSrc(pontaPng, 384, 70)).toBe(
      `/_next/image?url=${encodeURIComponent(pontaPng)}&w=384&q=70`,
    );
    expect(toNextImageOptimizerSrc(pontaPng, 384, 70)).not.toContain(
      'https://bovzk9ehhu.ufs.sh/',
    );
  });

  it('snaps w up to Next imageSizes/deviceSizes so /_next/image does not 400', () => {
    expect(NEXT_IMAGE_WIDTHS).toEqual(
      [
        ...imageConfigDefault.imageSizes,
        ...imageConfigDefault.deviceSizes,
      ].sort((a, b) => a - b),
    );
    expect(snapToNextImageWidth(24)).toBe(32);
    expect(snapToNextImageWidth(72)).toBe(96);
    expect(snapToNextImageWidth(80)).toBe(96);
    expect(snapToNextImageWidth(88)).toBe(96);
    expect(snapToNextImageWidth(112)).toBe(128);
    expect(snapToNextImageWidth(40)).toBe(48);
    expect(snapToNextImageWidth(48)).toBe(48);
    expect(snapToNextImageWidth(64)).toBe(64);
  });

  it('shares unoptimized and default sizes with apps/web next.config', () => {
    const config = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../../../../../apps/web/next.config.ts',
      ),
      'utf8',
    );
    expect(config).toContain('isNextImageOptimizationDisabled(');
    expect(config).toContain('NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION');
    expect(config).toContain('DISABLE_IMAGE_OPTIMIZATION');
    expect(config).not.toMatch(/imageSizes\s*:/);
    expect(config).not.toMatch(/deviceSizes\s*:/);
  });

  it('leaves local and remote SVGs off /_next/image', () => {
    expect(isLikelySvgSrc('/placeholder/space-avatar-image.svg')).toBe(true);
    expect(isLikelySvgSrc('https://bovzk9ehhu.ufs.sh/f/mark.svg?w=1')).toBe(
      true,
    );
    expect(
      shouldOptimizeRemoteImage('/placeholder/space-avatar-image.svg'),
    ).toBe(false);
    expect(
      shouldOptimizeRemoteImage('https://bovzk9ehhu.ufs.sh/f/mark.svg'),
    ).toBe(false);
    expect(
      toNextImageOptimizerSrc('/placeholder/space-avatar-image.svg', 64, 70),
    ).toBe('/placeholder/space-avatar-image.svg');
    expect(
      toNextImageOptimizerSrc('https://bovzk9ehhu.ufs.sh/f/mark.svg', 64, 70),
    ).toBe('https://bovzk9ehhu.ufs.sh/f/mark.svg');
  });

  it('returns the original src when DISABLE_IMAGE_OPTIMIZATION is true', () => {
    const previous = process.env.DISABLE_IMAGE_OPTIMIZATION;
    const previousPublic = process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION;
    delete process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION;
    process.env.DISABLE_IMAGE_OPTIMIZATION = 'true';
    const pontaPng =
      'https://bovzk9ehhu.ufs.sh/f/6MiOwFUJuAcocp3uZG4AN0lxYkareI1GvqLDX2FV5jh8d4fo';
    try {
      expect(isNextImageOptimizationDisabled()).toBe(true);
      expect(shouldOptimizeRemoteImage(pontaPng)).toBe(false);
      expect(toNextImageOptimizerSrc(pontaPng, 128, 70)).toBe(pontaPng);
    } finally {
      if (previous === undefined) {
        delete process.env.DISABLE_IMAGE_OPTIMIZATION;
      } else {
        process.env.DISABLE_IMAGE_OPTIMIZATION = previous;
      }
      if (previousPublic === undefined) {
        delete process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION;
      } else {
        process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION = previousPublic;
      }
    }
  });

  it('returns the original src from the client-inlined NEXT_PUBLIC flag', () => {
    const previous = process.env.DISABLE_IMAGE_OPTIMIZATION;
    const previousPublic = process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION;
    delete process.env.DISABLE_IMAGE_OPTIMIZATION;
    process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION = 'true';
    const pontaPng =
      'https://bovzk9ehhu.ufs.sh/f/6MiOwFUJuAcocp3uZG4AN0lxYkareI1GvqLDX2FV5jh8d4fo';
    try {
      expect(isNextImageOptimizationDisabled()).toBe(true);
      expect(shouldOptimizeRemoteImage(pontaPng)).toBe(false);
      expect(toNextImageOptimizerSrc(pontaPng, 128, 70)).toBe(pontaPng);
      expect(toCanvasSampleSrc(pontaPng)).toBeNull();
    } finally {
      if (previous === undefined) {
        delete process.env.DISABLE_IMAGE_OPTIMIZATION;
      } else {
        process.env.DISABLE_IMAGE_OPTIMIZATION = previous;
      }
      if (previousPublic === undefined) {
        delete process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION;
      } else {
        process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION = previousPublic;
      }
    }
  });

  it('does not double-wrap an already-optimized src', () => {
    const pontaPng =
      'https://bovzk9ehhu.ufs.sh/f/6MiOwFUJuAcocp3uZG4AN0lxYkareI1GvqLDX2FV5jh8d4fo';
    const once = toNextImageOptimizerSrc(pontaPng, 112, 70);
    expect(once).toBe(
      `/_next/image?url=${encodeURIComponent(pontaPng)}&w=128&q=70`,
    );
    expect(toNextImageOptimizerSrc(once, 256, 70)).toBe(once);
    expect(once.match(/\/_next\/image\?/g)).toHaveLength(1);
  });

  it('never assigns a remote PNG to a canvas Image() src', () => {
    const pontaPng =
      'https://bovzk9ehhu.ufs.sh/f/6MiOwFUJuAcocp3uZG4AN0lxYkareI1GvqLDX2FV5jh8d4fo';
    const sample = toCanvasSampleSrc(pontaPng);
    expect(sample).toBe(
      `/_next/image?url=${encodeURIComponent(pontaPng)}&w=64&q=60`,
    );
    expect(sample?.startsWith('https://')).toBe(false);
    expect(
      toCanvasSampleSrc('https://bovzk9ehhu.ufs.sh/f/logo.gif'),
    ).toBeNull();
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
    expect(
      toNextImageOptimizerSrc(
        'https://bovzk9ehhu.ufs.sh/f/community-logo.gif',
        64,
      ),
    ).toBe('https://bovzk9ehhu.ufs.sh/f/community-logo.gif');
  });
});
