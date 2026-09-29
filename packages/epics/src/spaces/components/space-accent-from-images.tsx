'use client';

import * as React from 'react';
import { cn } from '@hypha-platform/ui-utils';
import {
  readBannerAccent,
  type BannerAccentProfile,
} from '../utils/extract-space-accent';
import {
  analyzeBannerToneFromImageData,
  DEFAULT_BANNER_OVERLAY_CSS_VARS,
  overlayCssVarsFromTone,
} from '../utils/banner-overlay-tone';
import {
  buildSpaceScopeStyleFromSampledAccents,
  DEFAULT_SPACE_SCOPE_STYLE,
} from '../utils/space-accent-scope-style';
import { defaultSpacePortalStyles } from '../utils/space-accent-portal-styles';
import { useSetSpaceAccentPortalStyles } from './space-accent-portal-context';

/** Keys mirrored to `document.documentElement` so portaled UI (e.g. Human Chat) uses space accent. */
const DOCUMENT_ACCENT_MIRROR_PREFIXES = [
  '--color-accent',
  '--space-accent',
] as const;
const DOCUMENT_ACCENT_MIRROR_EXACT = new Set(['--space-tab-active-border']);

/** Avoid clearing `:root` accent vars while another `SpaceAccentFromImages` is mounted. */
let documentAccentMirrorInstanceCount = 0;

function shouldMirrorAccentKey(key: string): boolean {
  if (DOCUMENT_ACCENT_MIRROR_EXACT.has(key)) return true;
  return DOCUMENT_ACCENT_MIRROR_PREFIXES.some((p) => key.startsWith(p));
}

function mirrorSpaceAccentVarsToDocument(
  style: Record<string, string | number | undefined>,
  mirroredKeysRef: React.MutableRefObject<string[]>,
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const key of mirroredKeysRef.current) {
    root.style.removeProperty(key);
  }
  const next: string[] = [];
  for (const [k, v] of Object.entries(style)) {
    if (v === undefined || v === null) continue;
    if (!shouldMirrorAccentKey(k)) continue;
    root.style.setProperty(k, String(v));
    next.push(k);
  }
  mirroredKeysRef.current = next;
}

function clearDocumentAccentMirror(
  mirroredKeysRef: React.MutableRefObject<string[]>,
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const key of mirroredKeysRef.current) {
    root.style.removeProperty(key);
  }
  mirroredKeysRef.current = [];
}

export type SpaceAccentFromImagesProps = {
  bannerSrc: string;
  logoSrc: string;
  children: React.ReactNode;
  /** Optional class on the wrapping element that receives CSS variables */
  className?: string;
};

/**
 * Same-origin image URL so canvas readPixels works for remote hosts without CORS
 * (Next.js Image Optimization proxies the bytes). Null for unsupported URLs.
 */
function canvasFriendlyImageSrc(src: string): string | null {
  const t = src.trim();
  if (!t) return null;
  /** Same-origin path — reject protocol-relative `//evil` */
  if (t.startsWith('/')) {
    return t.startsWith('//') ? null : t;
  }
  if (typeof window === 'undefined') return null;
  try {
    const u = new URL(t);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return `/_next/image?url=${encodeURIComponent(t)}&w=96&q=75`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function loadImageData(
  src: string,
  maxSide: number,
): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const friendlySrc = canvasFriendlyImageSrc(src);
    if (!friendlySrc) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
        const w = Math.max(8, Math.round(img.width * scale));
        const h = Math.max(8, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(ctx.getImageData(0, 0, w, h));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = friendlySrc;
  });
}

async function sampleImageToAccent(src: string): Promise<string | null> {
  const data = await loadImageData(src, 96);
  if (!data) return null;
  return readBannerAccent(data).hex;
}

async function sampleBannerReading(src: string): Promise<{
  hex: string | null;
  profile: BannerAccentProfile | null;
}> {
  const data = await loadImageData(src, 96);
  if (!data) return { hex: null, profile: null };
  return readBannerAccent(data);
}

/** Larger sample grid for luminance / contrast / edge analysis (banner only). */
async function sampleBannerToneOverlayVars(
  src: string,
): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    const friendlySrc = canvasFriendlyImageSrc(src);
    if (!friendlySrc) {
      resolve(null);
      return;
    }
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
    img.src = friendlySrc;
  });
}

/**
 * Samples the cover into one hue family and exposes the crafted mid
 * (`--space-accent`) plus deep and luminous stops for the identity-row wash.
 * The logo is used only when the cover has no chromatic family.
 */
export function SpaceAccentFromImages({
  bannerSrc,
  logoSrc,
  children,
  className,
}: SpaceAccentFromImagesProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const setPortalStyles = useSetSpaceAccentPortalStyles();
  const documentMirroredKeysRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    documentAccentMirrorInstanceCount += 1;

    const scopeElInit = ref.current;
    if (scopeElInit) {
      for (const [k, v] of Object.entries(DEFAULT_SPACE_SCOPE_STYLE)) {
        if (v === undefined || v === null) continue;
        if (process.env.NODE_ENV !== 'production') {
          console.assert(
            k.startsWith('--'),
            `Invalid CSS custom property: ${k}`,
          );
        }
        scopeElInit.style.setProperty(k, String(v));
      }
    }
    setPortalStyles?.(defaultSpacePortalStyles);
    mirrorSpaceAccentVarsToDocument(
      DEFAULT_SPACE_SCOPE_STYLE as Record<string, string | number | undefined>,
      documentMirroredKeysRef,
    );

    (async () => {
      const [bannerReading, logoAccent, overlayRecord] = await Promise.all([
        sampleBannerReading(bannerSrc),
        sampleImageToAccent(logoSrc),
        sampleBannerToneOverlayVars(bannerSrc),
      ]);
      if (cancelled || !ref.current) return;

      const scopeEl = ref.current;
      const overlayVars = overlayRecord ?? DEFAULT_BANNER_OVERLAY_CSS_VARS;

      const scopeStyle = buildSpaceScopeStyleFromSampledAccents({
        bannerAccent: bannerReading.hex,
        logoAccent,
        bannerProfile: bannerReading.profile,
        overlayVars,
      });

      for (const [k, v] of Object.entries(scopeStyle)) {
        if (v === undefined || v === null) continue;
        if (process.env.NODE_ENV !== 'production') {
          console.assert(
            k.startsWith('--'),
            `Invalid CSS custom property: ${k}`,
          );
        }
        scopeEl.style.setProperty(k, String(v));
      }

      setPortalStyles?.(scopeStyle);
      mirrorSpaceAccentVarsToDocument(
        scopeStyle as Record<string, string | number | undefined>,
        documentMirroredKeysRef,
      );
    })();

    return () => {
      cancelled = true;
      documentAccentMirrorInstanceCount -= 1;
      if (documentAccentMirrorInstanceCount <= 0) {
        documentAccentMirrorInstanceCount = 0;
        clearDocumentAccentMirror(documentMirroredKeysRef);
      } else {
        documentMirroredKeysRef.current = [];
      }
    };
  }, [bannerSrc, logoSrc, setPortalStyles]);

  return (
    <div
      ref={ref}
      data-space-accent-scope
      className={cn(className)}
      style={DEFAULT_SPACE_SCOPE_STYLE}
    >
      {children}
    </div>
  );
}
