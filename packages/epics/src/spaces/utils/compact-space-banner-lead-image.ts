/** Banner plate is the main column, not the full viewport. */
export const COMPACT_SPACE_BANNER_LEAD_SIZES =
  '(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1120px';

/** Legacy UploadThing hosts that still break `/_next/image` downscaling. */
const UNOPTIMIZED_REMOTE_IMAGE_HOSTS = new Set(['utfs.io', 'uploadthing.com']);

function isUnoptimizedCdnHost(hostname: string): boolean {
  return (
    UNOPTIMIZED_REMOTE_IMAGE_HOSTS.has(hostname) ||
    hostname.endsWith('.utfs.io') ||
    hostname.endsWith('.uploadthing.com')
  );
}

export function shouldUseUnoptimizedRemoteImage(src: string): boolean {
  if (!src.startsWith('http://') && !src.startsWith('https://')) {
    return false;
  }
  try {
    return isUnoptimizedCdnHost(new URL(src).hostname.toLowerCase());
  } catch {
    return false;
  }
}
