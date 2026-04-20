import type * as React from 'react';
import { mixHexColors, SPACE_ACCENT_FALLBACK } from './extract-space-accent';
import { DEFAULT_BANNER_OVERLAY_CSS_VARS } from './banner-overlay-tone';
import { buildSpaceScopeStyle } from './space-accent-scope-style';

function brightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function contrastingForeground(hex: string): string {
  return brightness(hex) > 186 ? '#0f172a' : '#f8fafc';
}

export type SpaceAccentPortalStyles = React.CSSProperties;

/** Baseline portal styles (SSR + bridge init) until client canvas updates */
export function getDefaultSpacePortalStyles(): SpaceAccentPortalStyles {
  const accent = SPACE_ACCENT_FALLBACK;
  const fg = contrastingForeground(accent);
  const muted = mixHexColors(
    accent,
    brightness(accent) > 186 ? '#0f172a' : '#ffffff',
    0.45,
  );
  return buildSpaceScopeStyle({
    accent,
    foreground: fg,
    muted,
    overlayVars: DEFAULT_BANNER_OVERLAY_CSS_VARS,
  });
}

export const defaultSpacePortalStyles = getDefaultSpacePortalStyles();
