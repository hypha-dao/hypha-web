import {
  cspMediaSrcSources,
  isUrlAllowedByCspSources,
  matrixHomeserverOrigin,
  parseCspImageHosts,
} from '@hypha-platform/core/csp';

export type SignalVideoEmbed =
  | { kind: 'youtube'; src: string }
  | { kind: 'vimeo'; src: string }
  | { kind: 'file'; src: string };

function hostIs(hostname: string, root: string): boolean {
  const host = hostname.toLowerCase();
  return host === root || host.endsWith(`.${root}`);
}

function youtubeId(url: URL): string | null {
  if (url.hostname === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id || null;
  }
  if (!hostIs(url.hostname, 'youtube.com')) return null;
  if (url.pathname === '/watch') return url.searchParams.get('v');
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
    return parts[1] || null;
  }
  return null;
}

function vimeoId(url: URL): string | null {
  if (!hostIs(url.hostname, 'vimeo.com')) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[0] === 'video' ? parts[1] : parts[0];
  return id && /^\d+$/.test(id) ? id : null;
}

function isDirectVideo(url: URL): boolean {
  return /\.(mp4|webm|ogg|mov)(\b|$)/i.test(url.pathname);
}

/** Still image for a YouTube embed. Vimeo thumbnails come from oEmbed. */
export function signalVideoPoster(video: SignalVideoEmbed): string | null {
  if (video.kind !== 'youtube') return null;
  const id = video.src.split('/').filter(Boolean).pop()?.split('?')[0];
  if (!id) return null;
  return `https://i.ytimg.com/vi/${decodeURIComponent(id)}/hqdefault.jpg`;
}

/** Numeric Vimeo id from an embed URL, for the oEmbed thumbnail. */
export function vimeoPosterId(video: SignalVideoEmbed): string | null {
  if (video.kind !== 'vimeo') return null;
  const id = video.src.split('/').filter(Boolean).pop()?.split('?')[0] ?? '';
  return /^\d+$/.test(id) ? id : null;
}

/** Turn a pasted video link into something the signal detail can play. */
export function resolveSignalVideo(
  raw: string | null | undefined,
): SignalVideoEmbed | null {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const youtube = youtubeId(url);
  if (youtube) {
    return {
      kind: 'youtube',
      src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
        youtube,
      )}`,
    };
  }
  const vimeo = vimeoId(url);
  if (vimeo) {
    return {
      kind: 'vimeo',
      src: `https://player.vimeo.com/video/${encodeURIComponent(vimeo)}`,
    };
  }
  if (isDirectVideo(url)) {
    return { kind: 'file', src: url.toString() };
  }
  return null;
}

/**
 * Why a pasted link would not play: `unsupported` is neither YouTube, Vimeo
 * nor a video file; `blocked` is a video file whose host the CSP `media-src`
 * does not allow, so the browser would show a black, silent player.
 */
export type SignalVideoLinkProblem = 'unsupported' | 'blocked';

/** The `media-src` list the middleware sends, rebuilt from public env. */
export function signalVideoMediaSources(): string[] {
  return cspMediaSrcSources({
    imageHosts: parseCspImageHosts(process.env.NEXT_PUBLIC_IMAGE_HOSTS),
    matrixOrigin: matrixHomeserverOrigin(
      process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL,
    ),
  });
}

export function signalVideoLinkProblem(
  raw: string | null | undefined,
  {
    mediaSources = signalVideoMediaSources(),
    selfOrigin = typeof window === 'undefined' ? null : window.location.origin,
  }: { mediaSources?: readonly string[]; selfOrigin?: string | null } = {},
): SignalVideoLinkProblem | null {
  if (!raw?.trim()) return null;
  const video = resolveSignalVideo(raw);
  if (!video) return 'unsupported';
  if (video.kind !== 'file') return null;
  return isUrlAllowedByCspSources(video.src, mediaSources, selfOrigin)
    ? null
    : 'blocked';
}

/** Host shown when a direct video link is blocked. */
export function signalVideoLinkHost(raw: string | null | undefined): string {
  try {
    return new URL(raw?.trim() ?? '').host;
  } catch {
    return '';
  }
}

function fileStem(value: string) {
  return value.split(/[?#]/)[0] ?? '';
}

/** Upload URLs often have no extension. The original file name still does. */
function matchesExtension(
  url: string,
  name: string | undefined,
  pattern: RegExp,
) {
  return pattern.test(fileStem(name ?? '')) || pattern.test(fileStem(url));
}

export function isPdfAttachment(url: string, name?: string): boolean {
  return matchesExtension(url, name, /\.pdf$/i);
}

export function isImageAttachment(url: string, name?: string): boolean {
  return matchesExtension(url, name, /\.(png|jpe?g|gif|webp|svg)$/i);
}
