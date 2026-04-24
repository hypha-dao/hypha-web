'use client';

import * as React from 'react';
import { cn } from '@hypha-platform/ui-utils';
import { extractAccentHexFromImageData } from '../utils/extract-space-accent';
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
  /**
   * When set, used to sample space accent from the **logo** image (while `logoSrc` is still
   * used for child UI such as the hero). Defaults to `logoSrc`.
   */
  accentLogoSrc?: string;
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

async function sampleImageToAccent(src: string): Promise<string | null> {
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
    img.src = friendlySrc;
  });
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
 * Computes a dominant saturated accent from banner + logo imagery and exposes
 * `--space-accent`, `--space-accent-foreground`, `--space-accent-muted` on the wrapper.
 */
export function SpaceAccentFromImages({
  bannerSrc,
  logoSrc,
  accentLogoSrc,
  children,
  className,
}: SpaceAccentFromImagesProps) {
  const logoSrcForAccent = accentLogoSrc ?? logoSrc;
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
      const [bannerAccent, logoAccent, overlayRecord] = await Promise.all([
        sampleImageToAccent(bannerSrc),
        sampleImageToAccent(logoSrcForAccent),
        sampleBannerToneOverlayVars(bannerSrc),
      ]);
      if (cancelled || !ref.current) return;

      const scopeEl = ref.current;
      const overlayVars = overlayRecord ?? DEFAULT_BANNER_OVERLAY_CSS_VARS;

      const scopeStyle = buildSpaceScopeStyleFromSampledAccents({
        bannerAccent,
        logoAccent,
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
  }, [bannerSrc, logoSrc, logoSrcForAccent, setPortalStyles]);

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
