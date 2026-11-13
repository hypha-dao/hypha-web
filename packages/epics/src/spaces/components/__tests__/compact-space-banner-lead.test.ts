import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COMPACT_SPACE_BANNER_LEAD_SIZES,
  shouldUseUnoptimizedRemoteImage,
} from '../../utils/compact-space-banner-lead-image';

describe('CompactSpaceBannerLead image loading', () => {
  it('lets next/image size ufs.sh files', () => {
    expect(
      shouldUseUnoptimizedRemoteImage('https://abc.ufs.sh/f/space-banner.jpg'),
    ).toBe(false);
    expect(shouldUseUnoptimizedRemoteImage('https://ufs.sh/banner.jpg')).toBe(
      false,
    );
    expect(
      shouldUseUnoptimizedRemoteImage('https://utfs.io/f/legacy.jpg'),
    ).toBe(true);
    expect(COMPACT_SPACE_BANNER_LEAD_SIZES).not.toBe('100vw');
    expect(COMPACT_SPACE_BANNER_LEAD_SIZES).toContain('1120px');
  });

  it('does not double-fetch the original file with window.Image', () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../compact-space-banner-lead.tsx',
      ),
      'utf8',
    );
    expect(source).not.toContain('new window.Image()');
    expect(source).toContain('sizes={COMPACT_SPACE_BANNER_LEAD_SIZES}');
  });
});
