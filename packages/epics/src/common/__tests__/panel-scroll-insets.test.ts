import { describe, expect, it } from 'vitest';
import { resolveSidebarInsetPx } from '../panel-scroll-insets';

describe('resolveSidebarInsetPx', () => {
  it('keeps mobile sticky chrome full-bleed when the AI rail is a sheet', () => {
    expect(
      resolveSidebarInsetPx({
        isOnboarding: false,
        isMobileViewport: true,
        sideActive: true,
        measuredPx: 0,
        hasGapNodes: false,
        fallbackPx: '72px',
      }),
    ).toBe('0px');
  });

  it('does not use the icon-rail fallback when the gap measured 0 below xl', () => {
    expect(
      resolveSidebarInsetPx({
        isOnboarding: false,
        isMobileViewport: false,
        sideActive: true,
        measuredPx: 0,
        hasGapNodes: true,
        fallbackPx: '72px',
      }),
    ).toBe('0px');
  });

  it('uses the measured desktop gap when the rail is open', () => {
    expect(
      resolveSidebarInsetPx({
        isOnboarding: false,
        isMobileViewport: false,
        sideActive: true,
        measuredPx: 72,
        hasGapNodes: true,
        fallbackPx: '72px',
      }),
    ).toBe('72px');
  });

  it('falls back before the first gap measure on desktop', () => {
    expect(
      resolveSidebarInsetPx({
        isOnboarding: false,
        isMobileViewport: false,
        sideActive: true,
        measuredPx: 0,
        hasGapNodes: false,
        fallbackPx: '72px',
      }),
    ).toBe('72px');
  });

  it('stays at 0 when the side is inactive or onboarding', () => {
    expect(
      resolveSidebarInsetPx({
        isOnboarding: true,
        isMobileViewport: false,
        sideActive: true,
        measuredPx: 320,
        hasGapNodes: true,
        fallbackPx: '320px',
      }),
    ).toBe('0px');
    expect(
      resolveSidebarInsetPx({
        isOnboarding: false,
        isMobileViewport: false,
        sideActive: false,
        measuredPx: 72,
        hasGapNodes: true,
        fallbackPx: '72px',
      }),
    ).toBe('0px');
  });
});
