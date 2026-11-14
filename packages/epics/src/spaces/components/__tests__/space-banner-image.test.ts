import { describe, expect, it } from 'vitest';

import { SPACE_BANNER_IMAGE_SIZES } from '../../utils/space-banner-image';

describe('SPACE_BANNER_IMAGE_SIZES', () => {
  it('covers the 120% inset lead layer instead of capping at 640px', () => {
    expect(SPACE_BANNER_IMAGE_SIZES).toContain('120vw');
    expect(SPACE_BANNER_IMAGE_SIZES).not.toMatch(/,\s*640px\s*$/);
  });

  it('does not use CSS variables, which HTML sizes cannot resolve', () => {
    expect(SPACE_BANNER_IMAGE_SIZES).not.toContain('var(');
  });
});
