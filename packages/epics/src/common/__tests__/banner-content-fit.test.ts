import { describe, expect, it } from 'vitest';
import { planBannerContentFit } from '../main-column-scroll';

describe('planBannerContentFit', () => {
  it('keeps the banner offset when the content can fill the pane', () => {
    expect(planBannerContentFit(220, 800)).toEqual({
      top: 220,
      fillsBanner: true,
    });
  });

  it('lands on the header when the banner offset would leave a gap', () => {
    expect(planBannerContentFit(220, 0)).toEqual({
      top: 0,
      fillsBanner: false,
    });
  });

  it('does not stop part-way when a little overflow still hides the header', () => {
    expect(planBannerContentFit(220, 40)).toEqual({
      top: 0,
      fillsBanner: false,
    });
  });

  it('treats a target within a couple of pixels as filling', () => {
    expect(planBannerContentFit(100, 98)).toEqual({
      top: 100,
      fillsBanner: true,
    });
    expect(planBannerContentFit(100, 97).fillsBanner).toBe(false);
  });
});
