export type SignalVideoEmbed =
  | { kind: 'youtube'; src: string }
  | { kind: 'vimeo'; src: string }
  | { kind: 'file'; src: string };

function youtubeId(url: URL): string | null {
  if (url.hostname === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id || null;
  }
  if (!url.hostname.endsWith('youtube.com')) return null;
  if (url.pathname === '/watch') return url.searchParams.get('v');
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
    return parts[1] || null;
  }
  return null;
}

function vimeoId(url: URL): string | null {
  if (!url.hostname.endsWith('vimeo.com')) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[0] === 'video' ? parts[1] : parts[0];
  return id && /^\d+$/.test(id) ? id : null;
}

function isDirectVideo(url: URL): boolean {
  return /\.(mp4|webm|ogg|mov)(\b|$)/i.test(url.pathname);
}

/** Turn a pasted video link into something the signal detail can play. */
export function resolveSignalVideo(
  raw: string | null | undefined,
): SignalVideoEmbed | null {
  const trimmed = raw?.trim() ?? '';
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

export function isPdfAttachment(url: string, name?: string): boolean {
  const hint = `${name ?? ''} ${url}`.split(/[?#]/)[0] ?? '';
  return /\.pdf$/i.test(hint);
}

export function isImageAttachment(url: string, name?: string): boolean {
  const hint = `${name ?? ''} ${url}`.split(/[?#]/)[0] ?? '';
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(hint);
}
