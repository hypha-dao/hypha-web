'use client';

import * as React from 'react';
import { cn } from '@hypha-platform/ui-utils';
import {
  buildAccentPaletteFromHex,
  extractAccentHexFromImageData,
  mixHexColors,
  SPACE_ACCENT_FALLBACK,
} from '../utils/extract-space-accent';
import {
  analyzeBannerToneFromImageData,
  DEFAULT_BANNER_OVERLAY_CSS_VARS,
  overlayCssVarsFromTone,
} from '../utils/banner-overlay-tone';

export type SpaceAccentFromImagesProps = {
  bannerSrc: string;
  logoSrc: string;
  children: React.ReactNode;
  /** Optional class on the wrapping element that receives CSS variables */
  className?: string;
};

/** Perceived brightness 0–255 */
function brightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function contrastingForeground(hex: string): string {
  return brightness(hex) > 186 ? '#0f172a' : '#f8fafc';
}

/**
 * Same-origin image URL so canvas readPixels works for remote hosts without CORS
 * (Next.js Image Optimization proxies the bytes).
 */
function canvasFriendlyImageSrc(src: string): string {
  const t = src.trim();
  if (t.startsWith('/') || typeof window === 'undefined') {
    return t;
  }
  try {
    const u = new URL(t);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return `/_next/image?url=${encodeURIComponent(t)}&w=96&q=75`;
    }
  } catch {
    /* ignore */
  }
  return t;
}

async function sampleImageToAccent(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const maxSide = 96;
        const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
        const w = Math.max(8, Math.round(img.width * scale));
        const h = Math.max(8, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        resolve(extractAccentHexFromImageData(data));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = canvasFriendlyImageSrc(src);
  });
}

/** Larger sample grid for luminance / contrast / edge analysis (banner only). */
async function sampleBannerToneOverlayVars(
  src: string,
): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const maxSide = 112;
        const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
        const w = Math.max(16, Math.round(img.width * scale));
        const h = Math.max(16, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        const tone = analyzeBannerToneFromImageData(data);
        resolve(overlayCssVarsFromTone(tone));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = canvasFriendlyImageSrc(src);
  });
}

/**
 * Computes a dominant saturated accent from banner + logo imagery and exposes
 * `--space-accent`, `--space-accent-foreground`, `--space-accent-muted` on the wrapper.
 */
export function SpaceAccentFromImages({
  bannerSrc,
  logoSrc,
  children,
  className,
}: SpaceAccentFromImagesProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      const [bannerAccent, logoAccent, overlayVars] = await Promise.all([
        sampleImageToAccent(bannerSrc),
        sampleImageToAccent(logoSrc),
        sampleBannerToneOverlayVars(bannerSrc),
      ]);
      if (cancelled || !ref.current) return;

      let accent = SPACE_ACCENT_FALLBACK;
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
        brightness(accent) > 186 ? '#0f172a' : '#ffffff',
        0.45,
      );

      const el = ref.current;
      el.style.setProperty('--space-accent', accent);
      el.style.setProperty('--space-accent-foreground', fg);
      el.style.setProperty('--space-accent-muted', subtle);
      el.style.setProperty('--space-accent-contrast', fg);

      const palette = buildAccentPaletteFromHex(accent);
      for (const [key, value] of Object.entries(palette)) {
        el.style.setProperty(key, value);
      }

      const ov = overlayVars ?? DEFAULT_BANNER_OVERLAY_CSS_VARS;
      for (const [k, v] of Object.entries(ov)) {
        el.style.setProperty(k, v);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bannerSrc, logoSrc]);

  return (
    <div
      ref={ref}
      data-space-accent-scope
      className={cn(className)}
      style={DEFAULT_BANNER_OVERLAY_CSS_VARS as React.CSSProperties}
    >
      {children}
    </div>
  );
}
