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

/** Neutral metrics → calm precision-tool baseline (darker scrim, less chroma) */
export const BANNER_OVERLAY_FALLBACK_METRICS: BannerToneMetrics = {
  luminanceMean: 0.38,
  luminanceStd: 0.1,
  saturationMean: 0.28,
  edgeEnergy: 0.2,
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
  gray: Float32Array,
  width: number,
  height: number,
): number {
  if (width < 3 || height < 3) return 0;

  let sum = 0;
  let count = 0;

  const at = (yy: number, xx: number) => gray[yy * width + xx] ?? 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tl = at(y - 1, x - 1);
      const t = at(y - 1, x);
      const tr = at(y - 1, x + 1);
      const l = at(y, x - 1);
      const r = at(y, x + 1);
      const bl = at(y + 1, x - 1);
      const b = at(y + 1, x);
      const br = at(y + 1, x + 1);

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

  const nPx = width * height;
  const gray = new Float32Array(nPx);
  const sampled = new Uint8Array(nPx);

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

      const gi = y * width + x;
      gray[gi] = l;
      sampled[gi] = 1;

      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      const sat = max === 0 ? 0 : (max - min) / max;
      satSum += sat;
      satN++;
    }
  }

  if (lumas.length < 16) {
    return { ...BANNER_OVERLAY_FALLBACK_METRICS };
  }

  let meanL = 0;
  for (const v of lumas) meanL += v;
  meanL /= lumas.length;

  /** Avoid fake edges at transparent corners (e.g. logo PNG): fill gaps with mean luma */
  for (let i = 0; i < nPx; i++) {
    if (!sampled[i]) {
      gray[i] = meanL;
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

/** Portion of image-driven deviation from baseline (kept low — prefer calm scrim). */
const OVERLAY_DYNAMIC_STRENGTH = 0.28;

function overlayCssVarsFromToneRaw(m: BannerToneMetrics): BannerOverlayCssVars {
  const {
    luminanceMean: L,
    luminanceStd: spread,
    saturationMean: S,
    edgeEnergy: E,
  } = m;

  /**
   * brighter / more saturated image → stronger neutral scrim (eye-strain guard)
   */
  const brightNeed = clamp01((L - 0.32) / 0.55) * 0.85;
  const satNeed = clamp01((S - 0.28) / 0.55) * 0.55;
  /**
   * very dark hero → ease the bottom crush slightly
   */
  const darkEase = clamp01((0.2 - L) / 0.2) * 0.35;
  /**
   * Busy plates need a touch more vignette, not glow
   */
  const busy = clamp01(0.5 * spread + 0.5 * E);

  /** Vertical gradient — darker baseline so neon lead plates stay quiet */
  const vBottom = clamp01(
    0.78 + brightNeed * 0.1 + satNeed * 0.06 - darkEase * 0.1,
  );
  const vMid = clamp01(
    0.52 + brightNeed * 0.08 + satNeed * 0.05 - darkEase * 0.06,
  );
  const vTop = clamp01(
    0.38 + brightNeed * 0.08 + satNeed * 0.04 - darkEase * 0.05,
  );

  const hFrom = clamp01(
    0.42 + brightNeed * 0.08 + satNeed * 0.04 - darkEase * 0.04,
  );
  const hTo = clamp01(0.28 + brightNeed * 0.06 + satNeed * 0.03);

  /** Decorative layers retired — keep vars at near-zero for any legacy consumers */
  const accentWash = 0.02;
  const skylightOpacity = 0.05;
  const sheenOpacity = 0.02;
  const vignetteStrength = clamp01(
    0.85 + brightNeed * 0.08 + busy * 0.06 - darkEase * 0.06,
  );
  const grainOpacity = 0.02;

  const innerTop = clamp01(0.04 + brightNeed * 0.01);
  const innerBot = clamp01(0.2 + brightNeed * 0.04);

  return {
    '--banner-ov-v-bottom': String(vBottom),
    '--banner-ov-v-mid': String(vMid),
    '--banner-ov-v-top': String(vTop),
    '--banner-ov-v-mid-at': '48%',
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

/**
 * Blend dynamic overlay toward neutral baseline so the hero keeps more of its
 * native colour; `OVERLAY_DYNAMIC_STRENGTH` controls how much image tone may move the stack.
 */
function blendOverlayTowardBaseline(
  dynamic: BannerOverlayCssVars,
  baseline: BannerOverlayCssVars,
  strength: number,
): BannerOverlayCssVars {
  const out: BannerOverlayCssVars = { ...baseline };
  for (const key of Object.keys(dynamic)) {
    if (key === '--banner-ov-v-mid-at') {
      out[key] = dynamic[key] ?? baseline[key] ?? '52%';
      continue;
    }
    const d = parseFloat(dynamic[key] ?? '');
    const b = parseFloat(baseline[key] ?? '');
    if (!Number.isFinite(d) || !Number.isFinite(b)) continue;
    const v = b + (d - b) * strength;
    out[key] = String(clamp01(v));
  }
  return out;
}

/**
 * Maps tone metrics to CSS variables consumed by `CompactSpaceBanner` overlays.
 * Neutral metrics match the classic PR #2165 static stack; real images get a gentle nudge only.
 */
export function overlayCssVarsFromTone(
  m: BannerToneMetrics,
): BannerOverlayCssVars {
  const baseline = overlayCssVarsFromToneRaw(BANNER_OVERLAY_FALLBACK_METRICS);
  const raw = overlayCssVarsFromToneRaw(m);
  return blendOverlayTowardBaseline(raw, baseline, OVERLAY_DYNAMIC_STRENGTH);
}

export const DEFAULT_BANNER_OVERLAY_CSS_VARS: BannerOverlayCssVars =
  overlayCssVarsFromTone(BANNER_OVERLAY_FALLBACK_METRICS);
