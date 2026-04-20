/**
 * Derive a single accent hex from RGBA image data by averaging saturated,
 * mid-tone pixels (skips near-gray / near-black / near-white).
 */

export const SPACE_ACCENT_FALLBACK = '#4a65d8';

/** Validates `#RRGGBB` for palette and mixHexColors callers. */
export function parseRgbFromHex(hex: string): [number, number, number] | null {
  const t = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(t)) return null;
  const r = parseInt(t.slice(1, 3), 16);
  const g = parseInt(t.slice(3, 5), 16);
  const b = parseInt(t.slice(5, 7), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return [r, g, b];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (x: number) =>
    clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** HSL in [0,1] ranges */
export function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h, s, l };
}

/**
 * HSL [0,1] → RGB 0–255. Used to build Radix-style accent ramps from one hex.
 */
export function hslToRgb(
  h: number,
  s: number,
  l: number,
): [number, number, number] {
  let r: number;
  let g: number;
  let b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Canonical lightness ladder (approx. Radix-style spread). Peaks mid-ramp then
 * darkens for hover / solid text slots — avoids duplicate L at steps 9–10.
 */
const ACCENT_LIGHTNESS_CURVE = [
  0.987, 0.971, 0.943, 0.898, 0.798, 0.648, 0.538, 0.472, 0.492, 0.438, 0.382,
  0.172,
] as const;

/**
 * Intrinsic chroma weights per step (0–1). Peaks around interactive steps so
 * primary CTAs feel vivid; tints steps 1–6 without going neon.
 */
const ACCENT_CHROMA_WEIGHT_CURVE = [
  0.06, 0.11, 0.18, 0.28, 0.42, 0.58, 0.72, 0.84, 0.92, 0.88, 0.76, 0.22,
] as const;

/** Tiny hue drift so steps feel nuanced without shifting away from sampled hue. */
function accentHueForStep(baseH: number, stepIndex: number): number {
  const i = stepIndex + 1;
  const drift = (i - 6.5) * 0.004 + Math.sin((i / 13) * Math.PI) * 0.006;
  let nh = baseH + drift;
  nh -= Math.floor(nh);
  return nh;
}

/** Blend toward extracted accent RGB so ramps stay tethered at high saturation. */
function softenTowardAccent(
  sample: string,
  baseHex: string,
  ratio: number,
): string {
  return mixHexColors(sample, baseHex, clamp(ratio, 0, 1));
}

/** 12-step Radix-style accent ramp (sufficient for Tailwind accent-1…12 bindings). */
export function buildAccentPaletteFromHex(
  baseHex: string,
): Record<string, string> {
  const fb = parseRgbFromHex(SPACE_ACCENT_FALLBACK)!;
  const [r0, g0, b0] = parseRgbFromHex(baseHex) ?? fb;
  const { h, s: s0, l: l0 } = rgbToHsl(r0, g0, b0);

  /** Greys need injected chroma or buttons read as neutral; cap so vivid sources stay controlled. */
  const chromaAnchor = clamp(0.14 + s0 * 0.92, 0.16, 0.62);
  const chromaCeil = clamp(chromaAnchor * 1.08 + 0.06, 0.22, 0.78);

  const out: Record<string, string> = {};
  for (let i = 0; i < 12; i++) {
    const step = i + 1;
    let l: number = ACCENT_LIGHTNESS_CURVE[i]!;
    /** Softly tie ladder to extracted luminance so dark banners don’t wash out mid-tones. */
    l = clamp(l * (1 - 0.11) + l0 * 0.11, 0.06, 0.992);

    const w = ACCENT_CHROMA_WEIGHT_CURVE[i]!;
    let s = chromaAnchor + (chromaCeil - chromaAnchor) * w;

    /** Extra chroma on primary/hover slots — capped so solids stay nuanced vs neon. */
    if (step === 9) s = clamp(s * 1.045 + 0.015, 0, 0.74);
    if (step === 10) s = clamp(s * 1.025, 0, 0.72);

    const hh = accentHueForStep(h, i);
    const [r, g, b] = hslToRgb(hh, clamp(s, 0, 1), clamp(l, 0, 1));
    const candidate = rgbToHex(r, g, b);

    /** Stronger tether on mid-ramp/interactive steps where HSL blows past brand hue */
    let tether = 0.07 + w * 0.16;
    if (step >= 8 && step <= 11) tether += 0.12;
    if (step === 9 || step === 10) tether += 0.06;

    out[`--color-accent-${step}`] = softenTowardAccent(
      candidate,
      baseHex,
      tether,
    );
  }

  const solid = out['--color-accent-9'] ?? baseHex;
  const solidRgb = parseRgbFromHex(solid) ?? fb;
  const [sr, sg, sb] = solidRgb;
  const lum = (sr * 299 + sg * 587 + sb * 114) / 1000;
  const onSolid = lum > 186 ? '#0f172a' : '#ffffff';

  /** Semantic slots used by buttons (bg-accent-9, text-accent-contrast, etc.) */
  out['--color-accent'] = solid;
  out['--color-accent-foreground'] = out['--color-accent-12'] ?? '#ffffff';
  out['--color-accent-contrast'] = onSolid;

  return out;
}

export function extractAccentHexFromImageData(data: ImageData): string {
  const px = data.data;
  const { width, height } = data;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let n = 0;

  /** Weighted fallback when strict filter yields few samples (dark overlays, grading). */
  let wrSum = 0;
  let wgSum = 0;
  let wbSum = 0;
  let wSum = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = px[i + 3] ?? 0;
      if (a < 40) continue;

      const r = px[i] ?? 0;
      const g = px[i + 1] ?? 0;
      const b = px[i + 2] ?? 0;
      const { s, l } = rgbToHsl(r, g, b);

      /** Prefer chromatic mid-tones; no min weight so grays are not forced to #808080 */
      const chromaWeight = clamp(s * (1 - Math.abs(l - 0.48) * 1.35), 0, 1);
      wrSum += r * chromaWeight;
      wgSum += g * chromaWeight;
      wbSum += b * chromaWeight;
      wSum += chromaWeight;

      if (s < 0.12) continue;
      if (l < 0.06 || l > 0.94) continue;

      rSum += r;
      gSum += g;
      bSum += b;
      n++;
    }
  }

  const achromaticSample = (hex: string): boolean => {
    const rgb = parseRgbFromHex(hex);
    if (!rgb) return true;
    return rgbToHsl(rgb[0], rgb[1], rgb[2]).s <= 0.045;
  };

  if (n >= 8) {
    const hex = rgbToHex(rSum / n, gSum / n, bSum / n);
    return achromaticSample(hex) ? SPACE_ACCENT_FALLBACK : hex;
  }

  if (wSum >= 8) {
    const hex = rgbToHex(wrSum / wSum, wgSum / wSum, wbSum / wSum);
    return achromaticSample(hex) ? SPACE_ACCENT_FALLBACK : hex;
  }

  return SPACE_ACCENT_FALLBACK;
}

export function mixHexColors(a: string, b: string, weightA: number): string {
  const fb = parseRgbFromHex(SPACE_ACCENT_FALLBACK)!;
  const ca = parseRgbFromHex(a) ?? fb;
  const cb = parseRgbFromHex(b) ?? fb;
  const [pa, ga, ba] = ca;
  const [pb, gb, bb] = cb;
  const w = clamp(weightA, 0, 1);
  return rgbToHex(
    pa * w + pb * (1 - w),
    ga * w + gb * (1 - w),
    ba * w + bb * (1 - w),
  );
}
