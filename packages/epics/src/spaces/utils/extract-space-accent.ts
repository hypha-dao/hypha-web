/**
 * Derive a single accent hex from RGBA image data by averaging saturated,
 * mid-tone pixels (skips near-gray / near-black / near-white).
 */

export const SPACE_ACCENT_FALLBACK = '#4a65d8';

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

export function extractAccentHexFromImageData(data: ImageData): string {
  const px = data.data;
  const { width, height } = data;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let n = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = px[i + 3] ?? 0;
      if (a < 40) continue;

      const r = px[i] ?? 0;
      const g = px[i + 1] ?? 0;
      const b = px[i + 2] ?? 0;
      const { s, l } = rgbToHsl(r, g, b);

      if (s < 0.12) continue;
      if (l < 0.06 || l > 0.94) continue;

      rSum += r;
      gSum += g;
      bSum += b;
      n++;
    }
  }

  if (n < 8) {
    return SPACE_ACCENT_FALLBACK;
  }

  return rgbToHex(rSum / n, gSum / n, bSum / n);
}

export function mixHexColors(a: string, b: string, weightA: number): string {
  const pa = parseInt(a.slice(1, 3), 16);
  const ga = parseInt(a.slice(3, 5), 16);
  const ba = parseInt(a.slice(5, 7), 16);
  const pb = parseInt(b.slice(1, 3), 16);
  const gb = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const w = clamp(weightA, 0, 1);
  return rgbToHex(
    pa * w + pb * (1 - w),
    ga * w + gb * (1 - w),
    ba * w + bb * (1 - w),
  );
}
