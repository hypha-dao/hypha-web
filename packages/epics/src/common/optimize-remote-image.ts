const UPLOADTHING_HOSTS = new Set(['ufs.sh', 'utfs.io', 'uploadthing.com']);
const UPLOADTHING_HOST_SUFFIXES = ['.ufs.sh', '.utfs.io', '.uploadthing.com'];

function configuredImageHosts(): string[] {
  return (process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Whether `next/image` can send this URL through `/_next/image`.
 * UploadThing originals are huge; those hosts are always optimized.
 * Other remote hosts must be listed in `NEXT_PUBLIC_IMAGE_HOSTS` or the
 * optimizer rejects them — those stay `unoptimized` (original src).
 */
export function shouldOptimizeRemoteImage(src: string): boolean {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
    return false;
  }
  if (!/^https?:\/\//i.test(src)) {
    return true;
  }
  try {
    const hostname = new URL(src).hostname.toLowerCase();
    if (UPLOADTHING_HOSTS.has(hostname)) return true;
    if (UPLOADTHING_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
      return true;
    }
    return configuredImageHosts().some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}
