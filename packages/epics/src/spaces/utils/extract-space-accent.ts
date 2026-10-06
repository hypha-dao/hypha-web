/**
 * Sample a cover image into one hue family, then craft a short gradient:
 * a deeper shade, a balanced mid (solid buttons), and a lighter luminous tone.
 * Chroma is compressed so a saturated banner cannot become neon.
 */

export const SPACE_ACCENT_FALLBACK = '#3d6b66';

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
 * Intrinsic chroma weights per step (0–1). Peaks gently around interactive
 * steps — colour stays a quiet signal, not a neon CTA.
 */
const ACCENT_CHROMA_WEIGHT_CURVE = [
  0.04, 0.08, 0.14, 0.22, 0.32, 0.44, 0.54, 0.62, 0.7, 0.66, 0.55, 0.18,
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

/** Hue-family reading from a cover. Lightness percentiles keep the wash with the image. */
export type BannerAccentProfile = {
  /** Dominant hue in [0, 1). */
  hue: number;
  /** Mean saturation of that hue family, [0, 1]. */
  saturation: number;
  /** Darker chromatic mass (~20th percentile lightness). */
  lightnessLow: number;
  /** Typical chromatic lightness. */
  lightnessMid: number;
  /** Brighter chromatic mass (~80th percentile lightness). */
  lightnessHigh: number;
};

/** Three crafted stops from one hue family. `mid` is the solid button fill. */
export type CraftedAccentGradient = {
  deep: string;
  mid: string;
  luminous: string;
};

const HUE_BIN_COUNT = 24;

function wrapHue(h: number): number {
  const wrapped = h % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = clamp((sorted.length - 1) * p, 0, sorted.length - 1);
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low]!;
  const highWeight = index - low;
  return sorted[low]! * (1 - highWeight) + sorted[high]! * highWeight;
}

/**
 * Fold sampled saturation into a crafted band.
 * Near-gray stays quiet. Neon sources compress instead of clipping to a flat highlighter.
 */
function craftChroma(rawSaturation: number): number {
  const saturation = clamp(rawSaturation, 0, 1);
  if (saturation < 0.1) return saturation * 0.85;
  const compressed = 0.24 + (1 - Math.exp(-saturation * 1.65)) * 0.26;
  return clamp(compressed, 0.24, 0.5);
}

function hexFromHsl(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(wrapHue(h), clamp(s, 0, 1), clamp(l, 0, 1));
  return rgbToHex(r, g, b);
}

/**
 * Build the wash from a cover reading. Call once per sample — a second pass
 * shifts lightness again and dulls the hue.
 */
export function craftAccentGradientFromProfile(
  profile: BannerAccentProfile,
): CraftedAccentGradient {
  const chroma = craftChroma(profile.saturation);
  const sDeep = clamp(chroma * 1.02, 0.22, 0.5);
  const sMid = clamp(chroma * 0.86, 0.2, 0.44);
  const sLum = clamp(chroma * 0.94, 0.22, 0.48);

  const lDeep = clamp(0.1 + profile.lightnessLow * 0.28, 0.14, 0.26);
  const lMid = clamp(0.3 + profile.lightnessMid * 0.22, 0.36, 0.46);
  const lLum = clamp(0.42 + profile.lightnessHigh * 0.22, 0.48, 0.58);

  return {
    deep: hexFromHsl(profile.hue - 0.022, sDeep, Math.min(lDeep, lMid - 0.1)),
    mid: hexFromHsl(profile.hue, sMid, lMid),
    luminous: hexFromHsl(
      profile.hue + 0.032,
      sLum,
      Math.max(lLum, lMid + 0.08),
    ),
  };
}

/** Same stops from a single hex when the cover did not yield a profile. */
export function craftAccentGradient(hex: string): CraftedAccentGradient {
  const fb = parseRgbFromHex(SPACE_ACCENT_FALLBACK)!;
  const [r0, g0, b0] = parseRgbFromHex(hex) ?? fb;
  const { h, s, l } = rgbToHsl(r0, g0, b0);
  return craftAccentGradientFromProfile({
    hue: h,
    saturation: s,
    lightnessLow: clamp(l * 0.62, 0.08, 0.4),
    lightnessMid: l,
    lightnessHigh: clamp(l + 0.18, 0.35, 0.82),
  });
}

/**
 * Balanced mid tone of the crafted gradient. Solid fills (NEW MEMORY and
 * other accent buttons) use this. The banner wash uses the full gradient.
 * Run once — `buildSpaceScopeStyle` is the only caller on the sampled path.
 */
export function craftAccentHex(hex: string): string {
  return craftAccentGradient(hex).mid;
}

/** 12-step Radix-style accent ramp (sufficient for Tailwind accent-1…12 bindings). */
export function buildAccentPaletteFromHex(
  baseHex: string,
): Record<string, string> {
  const fb = parseRgbFromHex(SPACE_ACCENT_FALLBACK)!;
  const [r0, g0, b0] = parseRgbFromHex(baseHex) ?? fb;
  const { h, s: s0, l: l0 } = rgbToHsl(r0, g0, b0);

  /** Soften saturated samples so space colour stays crafted, not plastic. */
  const chromaAnchor = clamp(0.1 + s0 * 0.55, 0.12, 0.38);
  const chromaCeil = clamp(chromaAnchor * 1.05 + 0.04, 0.16, 0.46);

  const out: Record<string, string> = {};
  for (let i = 0; i < 12; i++) {
    const step = i + 1;
    let l: number = ACCENT_LIGHTNESS_CURVE[i]!;
    /** Softly tie ladder to extracted luminance so dark banners don’t wash out mid-tones. */
    l = clamp(l * (1 - 0.11) + l0 * 0.11, 0.06, 0.992);

    const w = ACCENT_CHROMA_WEIGHT_CURVE[i]!;
    let s = chromaAnchor + (chromaCeil - chromaAnchor) * w;

    /** Barely lift primary/hover — enough to read as accent, not neon. */
    if (step === 9) s = clamp(s * 1.02, 0, 0.48);
    if (step === 10) s = clamp(s * 1.01, 0, 0.46);

    const hh = accentHueForStep(h, i);
    const [r, g, b] = hslToRgb(hh, clamp(s, 0, 1), clamp(l, 0, 1));
    const candidate = rgbToHex(r, g, b);

    /** Stronger tether on mid-ramp/interactive steps where HSL blows past brand hue */
    let tether = 0.1 + w * 0.2;
    if (step >= 8 && step <= 11) tether += 0.14;
    if (step === 9 || step === 10) tether += 0.08;

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

type HueBin = {
  weight: number;
  satWeighted: number;
  sin: number;
  cos: number;
  lights: number[];
};

function emptyHueBin(): HueBin {
  return { weight: 0, satWeighted: 0, sin: 0, cos: 0, lights: [] };
}

/**
 * Dominant hue of a cover, plus the dark / mid / bright lightness of that family.
 * A hue histogram avoids averaging purple and magenta into a muddy RGB mean.
 * Returns null when the image is too gray to personalize.
 */
export function extractBannerAccentProfile(
  data: ImageData,
): BannerAccentProfile | null {
  const px = data.data;
  const { width, height } = data;
  const bins = Array.from({ length: HUE_BIN_COUNT }, emptyHueBin);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = px[i + 3] ?? 0;
      if (a < 40) continue;

      const r = px[i] ?? 0;
      const g = px[i + 1] ?? 0;
      const b = px[i + 2] ?? 0;
      const { h, s, l } = rgbToHsl(r, g, b);
      if (s < 0.1 || l < 0.05 || l > 0.96) continue;

      /** Dark and bright chromatic pixels both count — they are the wash's ends. */
      const midBias = 1 - Math.min(1, Math.abs(l - 0.45) * 0.7);
      const weight = s * (0.4 + 0.6 * midBias) * (a / 255);
      const binIndex = Math.min(
        HUE_BIN_COUNT - 1,
        Math.floor(h * HUE_BIN_COUNT),
      );
      const bin = bins[binIndex]!;
      bin.weight += weight;
      bin.satWeighted += s * weight;
      const angle = h * Math.PI * 2;
      bin.sin += Math.sin(angle) * weight;
      bin.cos += Math.cos(angle) * weight;
      bin.lights.push(l);
    }
  }

  let best = 0;
  for (let i = 1; i < HUE_BIN_COUNT; i++) {
    if (bins[i]!.weight > bins[best]!.weight) best = i;
  }

  const neighbor = (index: number) =>
    bins[(index + HUE_BIN_COUNT) % HUE_BIN_COUNT]!;
  const group = [neighbor(best - 1), bins[best]!, neighbor(best + 1)];

  let weight = 0;
  let satWeighted = 0;
  let sin = 0;
  let cos = 0;
  const lights: number[] = [];
  for (const bin of group) {
    weight += bin.weight;
    satWeighted += bin.satWeighted;
    sin += bin.sin;
    cos += bin.cos;
    lights.push(...bin.lights);
  }
  if (weight < 1.5 || lights.length < 8) return null;

  lights.sort((a, b) => a - b);
  return {
    hue: wrapHue(Math.atan2(sin, cos) / (Math.PI * 2)),
    saturation: clamp(satWeighted / weight, 0, 1),
    lightnessLow: percentile(lights, 0.2),
    lightnessMid: percentile(lights, 0.5),
    lightnessHigh: percentile(lights, 0.8),
  };
}

/** Mean of chromatic pixels when a hue family cannot be resolved. */
function weightedAccentHex(data: ImageData): string | null {
  const px = data.data;
  const { width, height } = data;
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
      const chromaWeight = clamp(s * (1 - Math.abs(l - 0.48) * 1.35), 0.02, 1);
      wrSum += r * chromaWeight;
      wgSum += g * chromaWeight;
      wbSum += b * chromaWeight;
      wSum += chromaWeight;
    }
  }

  if (wSum >= 8) {
    return rgbToHex(wrSum / wSum, wgSum / wSum, wbSum / wSum);
  }
  return null;
}

export type BannerAccentReading = {
  hex: string | null;
  profile: BannerAccentProfile | null;
};

/** One pass over the cover: hue family when it exists, otherwise a weighted hex. */
export function readBannerAccent(data: ImageData): BannerAccentReading {
  const profile = extractBannerAccentProfile(data);
  if (!profile) {
    return { hex: weightedAccentHex(data), profile: null };
  }
  return {
    hex: hexFromHsl(profile.hue, profile.saturation, profile.lightnessMid),
    profile,
  };
}

export function extractAccentHexFromImageData(data: ImageData): string {
  return readBannerAccent(data).hex ?? SPACE_ACCENT_FALLBACK;
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
