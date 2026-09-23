import { describe, expect, it } from 'vitest';
import {
  craftAccentGradient,
  craftAccentGradientFromProfile,
  craftAccentHex,
  extractBannerAccentProfile,
  rgbToHsl,
  parseRgbFromHex,
  type BannerAccentProfile,
} from '../extract-space-accent';
import { buildSpaceScopeStyleFromSampledAccents } from '../space-accent-scope-style';

function hueDistance(a: number, b: number): number {
  const distance = Math.abs(a - b);
  return Math.min(distance, 1 - distance);
}

function hslOf(hex: string) {
  const [r, g, b] = parseRgbFromHex(hex)!;
  return rgbToHsl(r, g, b);
}

function styleVar(
  style: ReturnType<typeof buildSpaceScopeStyleFromSampledAccents>,
  name: string,
): string {
  return (style as Record<string, string>)[name] ?? '';
}

const PURPLE_COVER: BannerAccentProfile = {
  hue: 0.82,
  saturation: 0.78,
  lightnessLow: 0.16,
  lightnessMid: 0.4,
  lightnessHigh: 0.64,
};

describe('craftAccentGradient', () => {
  it('keeps a neon sample inside one hue family with ordered lightness', () => {
    const stops = craftAccentGradient('#ff00ff');
    const deep = hslOf(stops.deep);
    const mid = hslOf(stops.mid);
    const luminous = hslOf(stops.luminous);

    expect(deep.l).toBeLessThan(mid.l);
    expect(mid.l).toBeLessThan(luminous.l);
    expect(deep.s).toBeLessThanOrEqual(0.5);
    expect(mid.s).toBeLessThanOrEqual(0.44);
    expect(luminous.s).toBeLessThanOrEqual(0.48);
    expect(hueDistance(deep.h, mid.h)).toBeLessThan(0.05);
    expect(hueDistance(luminous.h, mid.h)).toBeLessThan(0.05);
    expect(stops.deep).not.toBe(stops.mid);
    expect(stops.luminous).not.toBe(stops.mid);
  });

  it('crafts a sampled hex only once inside the space scope', () => {
    const neon = '#ff00ff';
    const once = craftAccentHex(neon);
    const style = buildSpaceScopeStyleFromSampledAccents({
      bannerAccent: neon,
      logoAccent: null,
      overlayVars: null,
    });

    expect(styleVar(style, '--space-accent')).toBe(once);
    expect(styleVar(style, '--color-accent-9')).toBe(once);
    expect(once).not.toBe(craftAccentHex(once));
    expect(styleVar(style, '--space-accent-deep')).toBe(
      craftAccentGradient(neon).deep,
    );
    expect(styleVar(style, '--space-accent-luminous')).toBe(
      craftAccentGradient(neon).luminous,
    );
  });

  it('builds the wash from the cover profile, not a second craft of another hex', () => {
    const stops = craftAccentGradientFromProfile(PURPLE_COVER);
    const style = buildSpaceScopeStyleFromSampledAccents({
      bannerAccent: '#00ff00',
      logoAccent: '#00ff00',
      bannerProfile: PURPLE_COVER,
      overlayVars: null,
    });

    expect(styleVar(style, '--space-accent')).toBe(stops.mid);
    expect(styleVar(style, '--space-accent-deep')).toBe(stops.deep);
    expect(styleVar(style, '--space-accent-luminous')).toBe(stops.luminous);
    expect(stops.mid).not.toBe(craftAccentHex('#00ff00'));
    expect(hueDistance(hslOf(stops.mid).h, PURPLE_COVER.hue)).toBeLessThan(
      0.02,
    );
  });
});

describe('extractBannerAccentProfile', () => {
  it('reads a purple cover as a purple family rather than a muddy average', () => {
    const width = 48;
    const height = 24;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = x / (width - 1);
        const r = Math.round(40 + t * 150);
        const g = Math.round(12 + Math.sin(t * Math.PI) * 48);
        const b = Math.round(72 + (1 - t) * 40 + Math.sin(t * Math.PI) * 70);
        const i = (y * width + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }

    const profile = extractBannerAccentProfile({
      width,
      height,
      data,
      colorSpace: 'srgb',
    });

    expect(profile).not.toBeNull();
    expect(profile!.hue).toBeGreaterThan(0.68);
    expect(profile!.hue).toBeLessThan(0.98);
    expect(profile!.lightnessLow).toBeLessThan(profile!.lightnessHigh);
  });

  it('returns null for a gray field', () => {
    const data = new Uint8ClampedArray(16 * 16 * 4);
    data.fill(140);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    expect(
      extractBannerAccentProfile({
        width: 16,
        height: 16,
        data,
        colorSpace: 'srgb',
      }),
    ).toBeNull();
  });
});
