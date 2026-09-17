/**
 * UploadThing public file CDN hosts.
 *
 * v6 served files from `utfs.io` / `*.utfs.io`.
 * v7 serves them from an app-scoped subdomain (`<appId>.ufs.sh`), which is
 * distinct from the apex `ufs.sh`. Host checks that only allowlist the apex
 * (or only `*.utfs.io`) reject new banner/header URLs and `/_next/image` 400s.
 */

export const UPLOADTHING_CDN_HOST_SUFFIXES = ['.utfs.io', '.ufs.sh'] as const;

export const UPLOADTHING_IMAGE_REMOTE_PATTERNS = [
  { protocol: 'https', hostname: 'utfs.io' },
  { protocol: 'https', hostname: '*.utfs.io' },
  { protocol: 'https', hostname: 'ufs.sh' },
  { protocol: 'https', hostname: '*.ufs.sh' },
] as const;

export function isUploadThingCdnHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  return UPLOADTHING_CDN_HOST_SUFFIXES.some(
    (suffix) => host === suffix.slice(1) || host.endsWith(suffix),
  );
}

/** Remote UploadThing URLs must bypass `/_next/image` downscaling. */
export function isUploadThingCdnUrl(src: string): boolean {
  const trimmed = src.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return false;
  }
  try {
    return isUploadThingCdnHostname(new URL(trimmed).hostname);
  } catch {
    return false;
  }
}
