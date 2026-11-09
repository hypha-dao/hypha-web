import { describe, expect, it } from 'vitest';

import {
  isScrollRootAtEnd,
  siteFooterViewportOverlap,
} from '../site-footer-offset';

describe('isScrollRootAtEnd', () => {
  it('is true when content fits the viewport', () => {
    expect(
      isScrollRootAtEnd({
        scrollTop: 0,
        clientHeight: 900,
        scrollHeight: 800,
      }),
    ).toBe(true);
  });

  it('is false while there is room to scroll', () => {
    expect(
      isScrollRootAtEnd({
        scrollTop: 100,
        clientHeight: 900,
        scrollHeight: 2000,
      }),
    ).toBe(false);
  });

  it('is true at the bottom within slack', () => {
    expect(
      isScrollRootAtEnd({
        scrollTop: 1098,
        clientHeight: 900,
        scrollHeight: 2000,
      }),
    ).toBe(true);
  });
});

describe('siteFooterViewportOverlap', () => {
  it('is zero while the footer is still below the fold', () => {
    expect(
      siteFooterViewportOverlap({
        footerTop: 1000,
        footerHeight: 72,
        viewportHeight: 900,
      }),
    ).toBe(0);
  });

  it('matches the footer height when it sits on the bottom edge', () => {
    expect(
      siteFooterViewportOverlap({
        footerTop: 828,
        footerHeight: 72,
        viewportHeight: 900,
      }),
    ).toBe(72);
  });

  it('tracks a partially revealed footer', () => {
    expect(
      siteFooterViewportOverlap({
        footerTop: 860,
        footerHeight: 72,
        viewportHeight: 900,
      }),
    ).toBe(40);
  });

  it('ignores hairline peeks from the sticky list gap', () => {
    expect(
      siteFooterViewportOverlap({
        footerTop: 888,
        footerHeight: 72,
        viewportHeight: 900,
      }),
    ).toBe(0);
  });

  it('clamps to the visible slice when the footer straddles the top edge', () => {
    expect(
      siteFooterViewportOverlap({
        footerTop: -200,
        footerHeight: 250,
        viewportHeight: 900,
      }),
    ).toBe(50);
  });

  it('clears once the footer has scrolled above the viewport', () => {
    expect(
      siteFooterViewportOverlap({
        footerTop: -80,
        footerHeight: 72,
        viewportHeight: 900,
      }),
    ).toBe(0);
  });
});
