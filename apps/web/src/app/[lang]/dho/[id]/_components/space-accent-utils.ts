'use client';

export function parseHex(hex: string): [number, number, number] | null {
  const normalized = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return [r, g, b];
}

export function toSampleableImageSrc(src?: string | null): string | null {
  if (!src) return null;
  const candidate = src.trim();
  if (!candidate) return null;
  if (candidate.startsWith('/')) {
    return candidate.startsWith('//') ? null : candidate;
  }
  try {
    const url = new URL(candidate);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return `/_next/image?url=${encodeURIComponent(candidate)}&w=96&q=75`;
    }
  } catch {
    return null;
  }
  return null;
}

export async function sampleAccentHex(
  src?: string | null,
): Promise<string | null> {
  const imageSrc = toSampleableImageSrc(src);
  if (!imageSrc) return null;
  return await new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const maxSide = 96;
        const scale = Math.min(maxSide / image.width, maxSide / image.height, 1);
        const width = Math.max(8, Math.round(image.width * scale));
        const height = Math.max(8, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const alpha = pixels[i + 3] ?? 0;
          if (alpha < 40) continue;
          const r = pixels[i] ?? 0;
          const g = pixels[i + 1] ?? 0;
          const b = pixels[i + 2] ?? 0;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          if (saturation < 0.12) continue;
          rSum += r;
          gSum += g;
          bSum += b;
          count++;
        }
        if (count < 6) {
          resolve(null);
          return;
        }
        const r = Math.round(rSum / count)
          .toString(16)
          .padStart(2, '0');
        const g = Math.round(gSum / count)
          .toString(16)
          .padStart(2, '0');
        const b = Math.round(bSum / count)
          .toString(16)
          .padStart(2, '0');
        resolve(`#${r}${g}${b}`);
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = imageSrc;
  });
}
