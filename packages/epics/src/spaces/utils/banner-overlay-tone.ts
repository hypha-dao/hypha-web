/**
 * Derive tone metrics from RGBA image data for dynamic hero overlay modulation.
 * Focus: perceived luminance (intensity), spread (local contrast / "texture"),
 * and saturation (color radiance).
 */

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Perceived luminance in [0, 1] (standard sRGB approximation) */
function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export type BannerToneMetrics = {
  /** Mean perceived brightness [0, 1] */
  luminanceMean: number;
  /** Std. dev. of luminance — higher = busier / more contrast (edges, texture) */
  luminanceStd: number;
  /** Mean HSL saturation [0, 1] on reasonably opaque pixels */
  saturationMean: number;
  /** Mean gradient magnitude on a downscaled luma grid [0, ~1], normalized */
  edgeEnergy: number;
};

/**
 * Population variance (divide by n, not n-1) for stable small samples.
 */
function populationStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  let acc = 0;
  for (const v of values) {
    const d = v - mean;
    acc += d * d;
  }
  return Math.sqrt(acc / values.length);
}

/**
 * Sobel magnitude on grayscale grid; returns mean normalized gradient [0,1].
 */
function meanEdgeEnergy(
  gray: number[][],
  width: number,
  height: number,
): number {
  if (width < 3 || height < 3) return 0;

  let sum = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const rowUp = gray[y - 1];
      const rowMid = gray[y];
      const rowDn = gray[y + 1];
      const tl = rowUp?.[x - 1] ?? 0;
      const t = rowUp?.[x] ?? 0;
      const tr = rowUp?.[x + 1] ?? 0;
      const l = rowMid?.[x - 1] ?? 0;
      const r = rowMid?.[x + 1] ?? 0;
      const bl = rowDn?.[x - 1] ?? 0;
      const b = rowDn?.[x] ?? 0;
      const br = rowDn?.[x + 1] ?? 0;

      const gx = -tl + tr - 2 * l + 2 * r - bl + br;
      const gy = -tl - 2 * t - tr + bl + 2 * b + br;

      sum += Math.hypot(gx, gy);
      count++;
    }
  }

  if (count === 0) return 0;
  /** Typical max Sobel magnitude for 0–1 luma grid is ~4; soften with sqrt for spread */
  return clamp01(Math.sqrt(sum / count / 4));
}

export function analyzeBannerToneFromImageData(
  data: ImageData,
): BannerToneMetrics {
  const px = data.data;
  const { width, height } = data;
  const lumas: number[] = [];
  let satSum = 0;
  let satN = 0;

  const gray: number[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 0),
  );
  const sampled: boolean[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => false),
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = px[i + 3] ?? 0;
      if (a < 24) continue;

      const r = px[i] ?? 0;
      const g = px[i + 1] ?? 0;
      const b = px[i + 2] ?? 0;

      const l = luminance(r, g, b);
      lumas.push(l);

      gray[y]![x] = l;
      sampled[y]![x] = true;

      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      const sat = max === 0 ? 0 : (max - min) / max;
      satSum += sat;
      satN++;
    }
  }

  if (lumas.length < 16) {
    return {
      luminanceMean: 0.42,
      luminanceStd: 0.12,
      saturationMean: 0.35,
      edgeEnergy: 0.25,
    };
  }

  let meanL = 0;
  for (const v of lumas) meanL += v;
  meanL /= lumas.length;

  /** Avoid fake edges at transparent corners (e.g. logo PNG): fill gaps with mean luma */
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!sampled[y]?.[x]) {
        gray[y]![x] = meanL;
      }
    }
  }

  const stdL = populationStdDev(lumas, meanL);
  const edgeEnergy = meanEdgeEnergy(gray, width, height);
  const saturationMean = satN > 0 ? satSum / satN : 0.35;

  return {
    luminanceMean: clamp01(meanL),
    luminanceStd: clamp01(stdL * 2),
    saturationMean: clamp01(saturationMean),
    edgeEnergy: clamp01(edgeEnergy),
  };
}

export type BannerOverlayCssVars = Record<string, string>;

/**
 * Maps tone metrics to CSS variables consumed by `CompactSpaceBanner` overlays.
 * Defaults are tuned to match the previous static PR #2165 stack when metrics are neutral.
 */
export function overlayCssVarsFromTone(
  m: BannerToneMetrics,
): BannerOverlayCssVars {
  const {
    luminanceMean: L,
    luminanceStd: spread,
    saturationMean: S,
    edgeEnergy: E,
  } = m;

  /**
   * brighter image → stronger scrim for text legibility
   * (anchor around mid-photographic tone ~0.38)
   */
  const brightNeed = clamp01((L - 0.36) / 0.46);
  /**
   * very dark hero → ease the bottom crush so mud doesn't swallow midtones
   */
  const darkEase = clamp01((0.22 - L) / 0.22) * 0.55;
  /**
   * Radiance: colorful + luminous + micro-contrast → lift the WOW sheen slightly
   */
  const radiance = clamp01(0.35 * S + 0.35 * L + 0.3 * E);
  /**
   * Busy / high-frequency → soften film grain & glow so overlays don't shimmer
   */
  const calmGrain = clamp01(0.55 * spread + 0.45 * E);

  /** Vertical gradient stops (bottom → mid → top), PR #2165 baseline embedded */
  const vBottom = clamp01(0.88 + brightNeed * 0.09 - darkEase * 0.14);
  const vMid = clamp01(0.42 + brightNeed * 0.11 - darkEase * 0.08);
  const vTop = clamp01(0.22 + brightNeed * 0.09 - darkEase * 0.06);

  /** Horizontal vignette sides */
  const hFrom = clamp01(0.58 + brightNeed * 0.12 - darkEase * 0.06);
  const hTo = clamp01(0.4 + brightNeed * 0.08);

  /** Accent tint wash (was accent-11/18) — scales slightly with saturation radiance */
  const accentWash = clamp01(0.14 + radiance * 0.12);

  /** Depth pass layers */
  const skylightOpacity = clamp01(0.78 + radiance * 0.14 - calmGrain * 0.12);
  const sheenOpacity = clamp01(0.06 + radiance * 0.06);
  /** Scales alphas inside the bottom vignette radial (brighter heroes need a touch more) */
  const vignetteStrength = clamp01(0.92 + brightNeed * 0.14 - darkEase * 0.1);
  const grainOpacity = clamp01(0.055 + radiance * 0.025 - calmGrain * 0.028);

  const innerTop = clamp01(0.09 + radiance * 0.04);
  const innerBot = clamp01(0.18 + brightNeed * 0.04);

  return {
    '--banner-ov-v-bottom': String(vBottom),
    '--banner-ov-v-mid': String(vMid),
    '--banner-ov-v-top': String(vTop),
    '--banner-ov-v-mid-at': '52%',
    '--banner-ov-h-from': String(hFrom),
    '--banner-ov-h-to': String(hTo),
    '--banner-ov-accent-wash': String(accentWash),
    '--banner-ov-skylight-op': String(skylightOpacity),
    '--banner-ov-sheen-op': String(sheenOpacity),
    '--banner-ov-vignette-strength': String(vignetteStrength),
    '--banner-ov-grain-op': String(grainOpacity),
    '--banner-ov-inner-top': String(innerTop),
    '--banner-ov-inner-bot': String(innerBot),
  };
}

/** Neutral metrics → static overlay tuning (SSR / before client analysis) */
export const BANNER_OVERLAY_FALLBACK_METRICS: BannerToneMetrics = {
  luminanceMean: 0.42,
  luminanceStd: 0.12,
  saturationMean: 0.35,
  edgeEnergy: 0.25,
};

export const DEFAULT_BANNER_OVERLAY_CSS_VARS: BannerOverlayCssVars =
  overlayCssVarsFromTone(BANNER_OVERLAY_FALLBACK_METRICS);
