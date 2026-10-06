import type * as React from 'react';
import {
  buildAccentPaletteFromHex,
  craftAccentGradient,
  craftAccentGradientFromProfile,
  mixHexColors,
  parseRgbFromHex,
  rgbToHsl,
  SPACE_ACCENT_FALLBACK,
  type BannerAccentProfile,
} from './extract-space-accent';
import {
  DEFAULT_BANNER_OVERLAY_CSS_VARS,
  type BannerOverlayCssVars,
} from './banner-overlay-tone';

/** W3C-style luminance cutoff for choosing dark vs light foreground on accent */
const BRIGHTNESS_DARK_FG_THRESHOLD = 186;

function normalizeAccentHex(hex: string | null | undefined): string | null {
  if (hex == null) return null;
  const normalized = hex.trim();
  if (!normalized) return null;
  return parseRgbFromHex(normalized) ? normalized : null;
}

function brightness(hex: string): number {
  const fb = parseRgbFromHex(SPACE_ACCENT_FALLBACK)!;
  const [r, g, b] = parseRgbFromHex(hex) ?? fb;
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function contrastingForeground(hex: string): string {
  return brightness(hex) > BRIGHTNESS_DARK_FG_THRESHOLD ? '#0f172a' : '#f8fafc';
}

function saturationOf(hex: string): number {
  const rgb = parseRgbFromHex(hex);
  if (!rgb) return 0;
  return rgbToHsl(rgb[0], rgb[1], rgb[2]).s;
}

/**
 * Inline style bag for `[data-space-accent-scope]` and portaled DHO shells
 * (`ProposalOverlayShell`) so accent matches outside the DOM subtree.
 *
 * Crafts the cover once. Pass `profile` from the banner sample when it exists;
 * otherwise `accent` is crafted. Do not pre-craft `accent` — a second pass dulls it.
 */
export function buildSpaceScopeStyle(input: {
  accent: string;
  overlayVars: BannerOverlayCssVars;
  profile?: BannerAccentProfile | null;
}): React.CSSProperties {
  const { overlayVars } = input;
  const stops = input.profile
    ? craftAccentGradientFromProfile(input.profile)
    : craftAccentGradient(
        normalizeAccentHex(input.accent) ?? SPACE_ACCENT_FALLBACK,
      );
  const accent = stops.mid;
  const foreground = contrastingForeground(accent);
  const muted = mixHexColors(
    accent,
    brightness(accent) > BRIGHTNESS_DARK_FG_THRESHOLD ? '#0f172a' : '#ffffff',
    0.45,
  );
  const palette = buildAccentPaletteFromHex(accent);
  palette['--color-accent'] = accent;
  palette['--color-accent-9'] = accent;
  palette['--color-accent-10'] = mixHexColors(stops.deep, accent, 0.42);
  palette['--color-accent-contrast'] = foreground;

  const accentAliases: Record<string, string> = {};
  for (let step = 1; step <= 12; step++) {
    const colorToken = palette[`--color-accent-${step}`];
    if (colorToken) {
      accentAliases[`--accent-${step}`] = colorToken;
    }
  }
  if (palette['--color-accent']) {
    accentAliases['--accent'] = palette['--color-accent'];
  }
  if (palette['--color-accent-foreground']) {
    accentAliases['--accent-foreground'] = palette['--color-accent-foreground'];
  }
  accentAliases['--accent-contrast'] =
    palette['--color-accent-contrast'] ?? foreground;

  return {
    ...overlayVars,
    ...palette,
    ...accentAliases,
    '--space-accent': accent,
    '--space-accent-deep': stops.deep,
    '--space-accent-luminous': stops.luminous,
    /**
     * Readable accent-colored text on light surfaces (tabs, outline labels, links).
     * Solid-on-accent ink lives in `--space-accent-contrast` — do not reuse that here.
     */
    '--space-accent-foreground':
      palette['--color-accent-11'] ?? palette['--color-accent-12'] ?? accent,
    '--space-accent-muted': muted,
    '--space-accent-contrast': foreground,
    '--space-tab-active-border': accent,
  } as React.CSSProperties;
}

export function getDefaultSpaceScopeStyle(): React.CSSProperties {
  return buildSpaceScopeStyle({
    accent: SPACE_ACCENT_FALLBACK,
    overlayVars: DEFAULT_BANNER_OVERLAY_CSS_VARS,
  });
}

/** Module singleton for initial paint and resetting accent scope between samples */
export const DEFAULT_SPACE_SCOPE_STYLE = getDefaultSpaceScopeStyle();

/**
 * Canvas sampling results → same inline style bag as `buildSpaceScopeStyle`.
 * A chromatic cover profile is crafted once inside `buildSpaceScopeStyle`.
 * This function does not call `craftAccentHex`.
 */
export function buildSpaceScopeStyleFromSampledAccents(options: {
  bannerAccent: string | null;
  logoAccent: string | null;
  bannerProfile?: BannerAccentProfile | null;
  overlayVars: BannerOverlayCssVars | null;
}): React.CSSProperties {
  const profile =
    options.bannerProfile && options.bannerProfile.saturation >= 0.12
      ? options.bannerProfile
      : null;

  let accent = SPACE_ACCENT_FALLBACK;
  if (!profile) {
    const bannerAccent = normalizeAccentHex(options.bannerAccent);
    const logoAccent = normalizeAccentHex(options.logoAccent);
    if (bannerAccent && logoAccent) {
      const bannerSaturation = saturationOf(bannerAccent);
      const logoSaturation = saturationOf(logoAccent);
      if (bannerSaturation >= 0.12) {
        accent = mixHexColors(bannerAccent, logoAccent, 0.82);
      } else if (logoSaturation >= 0.12) {
        accent = logoAccent;
      } else {
        accent = bannerAccent;
      }
    } else if (bannerAccent) {
      accent = bannerAccent;
    } else if (logoAccent) {
      accent = logoAccent;
    }
  }

  return buildSpaceScopeStyle({
    accent,
    profile,
    overlayVars: options.overlayVars ?? DEFAULT_BANNER_OVERLAY_CSS_VARS,
  });
}
