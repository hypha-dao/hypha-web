import type * as React from 'react';
import {
  buildAccentPaletteFromHex,
  mixHexColors,
  SPACE_ACCENT_FALLBACK,
} from './extract-space-accent';
import {
  DEFAULT_BANNER_OVERLAY_CSS_VARS,
  type BannerOverlayCssVars,
} from './banner-overlay-tone';

/** W3C-style luminance cutoff for choosing dark vs light foreground on accent */
const BRIGHTNESS_DARK_FG_THRESHOLD = 186;

function brightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function contrastingForeground(hex: string): string {
  return brightness(hex) > BRIGHTNESS_DARK_FG_THRESHOLD ? '#0f172a' : '#f8fafc';
}

/**
 * Inline style bag for `[data-space-accent-scope]` and portaled DHO shells
 * (`ProposalOverlayShell`) so accent matches outside the DOM subtree.
 */
export function buildSpaceScopeStyle(input: {
  accent: string;
  foreground: string;
  muted: string;
  overlayVars: BannerOverlayCssVars;
}): React.CSSProperties {
  const { accent, foreground, muted, overlayVars } = input;
  const palette = buildAccentPaletteFromHex(accent);

  return {
    ...overlayVars,
    ...palette,
    '--space-accent': accent,
    '--space-accent-foreground': foreground,
    '--space-accent-muted': muted,
    '--space-accent-contrast': foreground,
    '--space-tab-active-border': accent,
  } as React.CSSProperties;
}

export function getDefaultSpaceScopeStyle(): React.CSSProperties {
  const accent = SPACE_ACCENT_FALLBACK;
  const fg = contrastingForeground(accent);
  const subtle = mixHexColors(
    accent,
    brightness(accent) > BRIGHTNESS_DARK_FG_THRESHOLD ? '#0f172a' : '#ffffff',
    0.45,
  );

  return buildSpaceScopeStyle({
    accent,
    foreground: fg,
    muted: subtle,
    overlayVars: DEFAULT_BANNER_OVERLAY_CSS_VARS,
  });
}

/** Module singleton for initial paint and resetting accent scope between samples */
export const DEFAULT_SPACE_SCOPE_STYLE = getDefaultSpaceScopeStyle();

/** Canvas sampling results → same inline style bag as `buildSpaceScopeStyle` */
export function buildSpaceScopeStyleFromSampledAccents(options: {
  bannerAccent: string | null;
  logoAccent: string | null;
  overlayVars: BannerOverlayCssVars | null;
}): React.CSSProperties {
  let accent = SPACE_ACCENT_FALLBACK;
  const { bannerAccent, logoAccent } = options;
  if (bannerAccent && logoAccent) {
    accent = mixHexColors(bannerAccent, logoAccent, 0.55);
  } else if (bannerAccent) {
    accent = bannerAccent;
  } else if (logoAccent) {
    accent = logoAccent;
  }

  const fg = contrastingForeground(accent);
  const subtle = mixHexColors(
    accent,
    brightness(accent) > BRIGHTNESS_DARK_FG_THRESHOLD ? '#0f172a' : '#ffffff',
    0.45,
  );

  return buildSpaceScopeStyle({
    accent,
    foreground: fg,
    muted: subtle,
    overlayVars: options.overlayVars ?? DEFAULT_BANNER_OVERLAY_CSS_VARS,
  });
}
