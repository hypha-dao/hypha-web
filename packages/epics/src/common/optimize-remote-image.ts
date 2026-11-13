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

function isRootRelativeSrc(src: string): boolean {
  return src.startsWith('/') && !src.startsWith('//');
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
 * Local optimized srcs must start with `/`. GIFs stay unoptimized.
 */
export function shouldOptimizeRemoteImage(src: string): boolean {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
    return false;
  }
  if (isLikelyGifSrc(src)) {
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
 * GIFs and other non-optimizable srcs are returned unchanged.
 */
export function toNextImageOptimizerSrc(
  src: string,
  width: number,
  quality = 70,
): string {
  if (!shouldOptimizeRemoteImage(src)) return src;
  const w = Math.max(1, Math.round(width));
  const q = Math.min(100, Math.max(1, Math.round(quality)));
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${q}`;
}
