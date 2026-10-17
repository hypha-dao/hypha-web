import { describe, expect, it } from 'vitest';
import {
  planBannerContentFit,
  planShortPageScroll,
} from '../main-column-scroll';

describe('planBannerContentFit', () => {
  it('keeps the banner offset when the content can fill the pane', () => {
    expect(planBannerContentFit(220, 800)).toEqual({
      top: 220,
      fillsBanner: true,
    });
  });

  it('keeps the banner offset when the page cannot scroll that far', () => {
    expect(planBannerContentFit(220, 0)).toEqual({
      top: 220,
      fillsBanner: false,
    });
  });

  it('does not stop part-way when a little overflow still hides the header', () => {
    expect(planBannerContentFit(220, 40)).toEqual({
      top: 220,
      fillsBanner: false,
    });
  });

  it('sits on the banner when the next screen cannot hold the old offset', () => {
    expect(
      planShortPageScroll({
        reservedTop: 1400,
        naturalMax: 80,
        bannerTop: 360,
        mobile: false,
        loading: false,
      }),
    ).toEqual({ kind: 'banner', top: 360 });
  });

  it('returns to the top on a short screen when there is no banner to pin', () => {
    expect(
      planShortPageScroll({
        reservedTop: 1400,
        naturalMax: 80,
        bannerTop: null,
        mobile: true,
        loading: false,
      }),
    ).toEqual({ kind: 'top' });
  });

  it('keeps a long screen where it was', () => {
    expect(
      planShortPageScroll({
        reservedTop: 400,
        naturalMax: 900,
        bannerTop: 220,
        mobile: false,
        loading: false,
      }),
    ).toEqual({ kind: 'keep', top: 400 });
  });

  it('does not treat a loading skeleton as a short screen', () => {
    expect(
      planShortPageScroll({
        reservedTop: 400,
        naturalMax: 0,
        bannerTop: 220,
        mobile: false,
        loading: true,
      }),
    ).toEqual({ kind: 'keep', top: 400 });
  });

  it('treats a target within a couple of pixels as filling', () => {
    expect(planBannerContentFit(100, 98)).toEqual({
      top: 100,
      fillsBanner: true,
    });
    expect(planBannerContentFit(100, 97)).toEqual({
      top: 100,
      fillsBanner: false,
    });
  });
});
