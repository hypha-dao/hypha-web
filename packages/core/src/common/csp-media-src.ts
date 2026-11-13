/**
 * The CSP `media-src` list, shared by the middleware that sends it and the
 * signal composer that must not publish a `<video>` the policy would block.
 */

/** UploadThing file CDN hosts (`*.ufs.sh` per app, older `utfs.io` links). */
export const UPLOADTHING_MEDIA_SOURCES = [
  'https://*.ufs.sh',
  'https://utfs.io',
  'https://*.utfs.io',
] as const;

/** `NEXT_PUBLIC_IMAGE_HOSTS` is a `", "`-separated host list. */
export function parseCspImageHosts(raw: string | null | undefined): string[] {
  return raw?.split(', ') ?? [];
}

/** Origin of the Matrix homeserver URL, or `''` when it is unset or invalid. */
export function matrixHomeserverOrigin(raw: string | null | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProtocol);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

/** Source expressions for `media-src`, in the order the header lists them. */
export function cspMediaSrcSources({
  imageHosts,
  matrixOrigin,
}: {
  imageHosts: readonly string[];
  matrixOrigin: string;
}): string[] {
  return [
    "'self'",
    'data:',
    'blob:',
    ...UPLOADTHING_MEDIA_SOURCES,
    ...(matrixOrigin ? [matrixOrigin] : []),
    ...imageHosts.map((host) => `https://${host}`),
  ];
}

function defaultPort(protocol: string): string {
  return protocol === 'https:' ? '443' : protocol === 'http:' ? '80' : '';
}

function schemeMatches(sourceScheme: string, url: URL): boolean {
  if (sourceScheme === url.protocol) return true;
  // CSP lets an http: source also match the secure upgrade.
  return sourceScheme === 'http:' && url.protocol === 'https:';
}

function hostSourceMatches(source: string, url: URL): boolean {
  const match =
    /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*|\*\.[^/:]+|[^/:*]+)(?::(\d+|\*))?(\/.*)?$/i.exec(
      source,
    );
  if (!match) return false;
  const [, scheme, host = '', port, path] = match;
  if (scheme) {
    if (!schemeMatches(`${scheme.toLowerCase()}:`, url)) return false;
  } else if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }

  const urlHost = url.hostname.toLowerCase();
  const sourceHost = host.toLowerCase();
  const hostMatches =
    sourceHost === '*' ||
    (sourceHost.startsWith('*.')
      ? urlHost.endsWith(sourceHost.slice(1))
      : urlHost === sourceHost);
  if (!hostMatches) return false;

  if (port !== '*') {
    const urlPort = url.port || defaultPort(url.protocol);
    const sourcePort =
      port ?? defaultPort(scheme ? `${scheme.toLowerCase()}:` : url.protocol);
    if (urlPort !== sourcePort) return false;
  }

  if (path && path !== '/') {
    const urlPath = url.pathname;
    return path.endsWith('/') ? urlPath.startsWith(path) : urlPath === path;
  }
  return true;
}

/**
 * Whether a CSP source list lets the browser load `rawUrl`. Covers `'self'`,
 * scheme sources (`data:`) and host sources with `*.` wildcards, ports and
 * paths; `'none'` and nonce/hash sources never match a URL.
 */
export function isUrlAllowedByCspSources(
  rawUrl: string,
  sources: readonly string[],
  selfOrigin: string | null,
): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  return sources.some((raw) => {
    const source = raw.trim();
    if (!source) return false;
    if (source === "'self'") {
      return selfOrigin != null && url.origin === selfOrigin;
    }
    if (source.startsWith("'")) return false;
    if (/^[a-z][a-z0-9+.-]*:$/i.test(source)) {
      return schemeMatches(source.toLowerCase(), url);
    }
    return hostSourceMatches(source, url);
  });
}
