import { imageConfigDefault } from 'next/dist/shared/lib/image-config';

/** Exact hosts listed in `apps/web/next.config.ts` `images.remotePatterns`. */
const UPLOADTHING_EXACT_HOSTS = new Set(['ufs.sh', 'utfs.io']);
/** `*.ufs.sh`, `*.utfs.io`, `*.uploadthing.com` — not bare `uploadthing.com`. */
const UPLOADTHING_WILDCARD_SUFFIXES = [
  '.ufs.sh',
  '.utfs.io',
  '.uploadthing.com',
];

/**
 * Same parse as `apps/web/next.config.ts` `images.remotePatterns`:
 * comma-separated hostnames, trimmed and lowercased. Next matches hostname
 * case-sensitively, so both sides must lowercase. Exact hosts — no subdomain
 * wildcard.
 */
export function parseConfiguredImageHosts(
  raw: string | null | undefined = process.env.NEXT_PUBLIC_IMAGE_HOSTS,
): string[] {
  return (raw ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Same flag `apps/web/next.config.ts` uses for `images.unoptimized`.
 * Client bundles only inline `NEXT_PUBLIC_*`, so next.config copies
 * `DISABLE_IMAGE_OPTIMIZATION` onto `NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION`.
 * Read the public name first, then the server name, so SSR and CSR agree.
 */
export function isNextImageOptimizationDisabled(
  publicRaw: string | null | undefined = process.env
    .NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION,
  serverRaw: string | null | undefined = process.env.DISABLE_IMAGE_OPTIMIZATION,
): boolean {
  return (publicRaw || serverRaw) === 'true';
}

/** Animated GIFs through `/_next/image` are slow and often a second original fetch. */
export function isLikelyGifSrc(src: string): boolean {
  if (!src) return false;
  try {
    const path = new URL(src, 'https://hypha.invalid').pathname.toLowerCase();
    return path.endsWith('.gif');
  } catch {
    return /\.gif(?:$|[?#])/i.test(src);
  }
}

/** Next `/_next/image` 400s SVGs unless `dangerouslyAllowSVG` is on (it is not). */
export function isLikelySvgSrc(src: string): boolean {
  if (!src) return false;
  try {
    const path = new URL(src, 'https://hypha.invalid').pathname.toLowerCase();
    return path.endsWith('.svg');
  } catch {
    return /\.svg(?:$|[?#])/i.test(src);
  }
}

function isRootRelativeSrc(src: string): boolean {
  return src.startsWith('/') && !src.startsWith('//');
}

/**
 * Next.js `/_next/image` `w` must be in `images.imageSizes` or
 * `images.deviceSizes`. `apps/web/next.config.ts` does not override them, so
 * this is `imageConfigDefault` — the same source Next applies.
 */
export const NEXT_IMAGE_WIDTHS: readonly number[] = [
  ...imageConfigDefault.imageSizes,
  ...imageConfigDefault.deviceSizes,
].sort((a, b) => a - b);

export function snapToNextImageWidth(width: number): number {
  const w = Math.max(1, Math.round(width));
  for (const size of NEXT_IMAGE_WIDTHS) {
    if (size >= w) return size;
  }
  return NEXT_IMAGE_WIDTHS[NEXT_IMAGE_WIDTHS.length - 1] ?? 3840;
}

export function isNextImageOptimizerSrc(src: string): boolean {
  return src.startsWith('/_next/image?');
}

function isAllowedOptimizerHost(hostname: string): boolean {
  if (UPLOADTHING_EXACT_HOSTS.has(hostname)) return true;
  if (
    UPLOADTHING_WILDCARD_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    return true;
  }
  return parseConfiguredImageHosts().includes(hostname);
}

/**
 * Whether `next/image` can send this URL through `/_next/image`.
 * Must match `apps/web/next.config.ts` `images.remotePatterns`: https only,
 * UploadThing wildcards as configured, and exact `NEXT_PUBLIC_IMAGE_HOSTS`.
 * Local optimized srcs must start with `/`. GIFs and SVGs stay unoptimized.
 */
export function shouldOptimizeRemoteImage(src: string): boolean {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
    return false;
  }
  if (isNextImageOptimizationDisabled()) return false;
  if (
    isNextImageOptimizerSrc(src) ||
    isLikelyGifSrc(src) ||
    isLikelySvgSrc(src)
  ) {
    return false;
  }
  if (!/^https?:\/\//i.test(src)) {
    return isRootRelativeSrc(src);
  }
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:') return false;
    return isAllowedOptimizerHost(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Browser-facing URL for a remote/local image that `next/image` can optimize.
 * The DOM `src` is `/_next/image?...` so Chrome never requests the UploadThing
 * original (including when `images.unoptimized` or a raw `<img>` would).
 * GIFs, SVGs, and other non-optimizable srcs are returned unchanged.
 */
export function toNextImageOptimizerSrc(
  src: string,
  width: number,
  quality = 70,
): string {
  if (isNextImageOptimizerSrc(src) || !shouldOptimizeRemoteImage(src)) {
    return src;
  }
  const w = snapToNextImageWidth(width);
  const q = Math.min(100, Math.max(1, Math.round(quality)));
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${q}`;
}

/**
 * URL for `new Image()` canvas sampling. Always same-origin `/_next/image`
 * for remote hosts next can proxy; never the UploadThing original. Null for
 * GIFs, SVGs, and anything the optimizer cannot fetch.
 */
export function toCanvasSampleSrc(
  src: string,
  width = 64,
  quality = 60,
): string | null {
  const t = src.trim();
  if (!t || isLikelyGifSrc(t) || isLikelySvgSrc(t)) return null;
  if (isNextImageOptimizerSrc(t)) return t;
  if (!shouldOptimizeRemoteImage(t)) return null;
  return toNextImageOptimizerSrc(t, width, quality);
}
