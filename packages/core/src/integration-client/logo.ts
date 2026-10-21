/**
 * Client logo rules (#2515, K21: the logo is served from Hypha storage, never
 * hot-linked, and shown only after the client is approved).
 *
 * The type is read from the file's own bytes, not from the name or the
 * declared content type. SVG is refused on purpose: it can carry script.
 */

export const CLIENT_LOGO_MAX_BYTES = 512 * 1024;
export const CLIENT_LOGO_MIN_SIDE = 32;
export const CLIENT_LOGO_MAX_SIDE = 2048;
/** "Square-ish": the long side may be at most this many times the short side. */
export const CLIENT_LOGO_MAX_ASPECT = 2;

export type ClientLogoType = 'png' | 'jpeg' | 'webp';

export const CLIENT_LOGO_MIME: Record<ClientLogoType, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export type ClientLogoRejection =
  | 'empty'
  | 'too_large'
  | 'unsupported_type'
  | 'unreadable'
  | 'bad_dimensions';

export type ClientLogoCheck =
  | {
      ok: true;
      type: ClientLogoType;
      mime: string;
      width: number;
      height: number;
    }
  | { ok: false; reason: ClientLogoRejection };

const ascii = (bytes: Uint8Array, start: number, text: string) =>
  text.length + start <= bytes.length &&
  [...text].every((char, i) => bytes[start + i] === char.charCodeAt(0));

const u16be = (b: Uint8Array, at: number) =>
  ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0);
const u32be = (b: Uint8Array, at: number) =>
  (((b[at] ?? 0) << 24) |
    ((b[at + 1] ?? 0) << 16) |
    ((b[at + 2] ?? 0) << 8) |
    (b[at + 3] ?? 0)) >>>
  0;

type Size = { width: number; height: number };

function pngSize(b: Uint8Array): Size | null {
  if (b.length < 24 || !ascii(b, 12, 'IHDR')) return null;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

/** Walk the segments to the first start-of-frame marker. */
function jpegSize(b: Uint8Array): Size | null {
  let at = 2;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1] ?? 0;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    const isFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isFrame) {
      if (at + 9 > b.length) return null;
      return { height: u16be(b, at + 5), width: u16be(b, at + 7) };
    }
    at += 2 + u16be(b, at + 2);
  }
  return null;
}

function webpSize(b: Uint8Array): Size | null {
  if (b.length < 30) return null;
  if (ascii(b, 12, 'VP8 ')) {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return {
      width: ((b[26] ?? 0) | ((b[27] ?? 0) << 8)) & 0x3fff,
      height: ((b[28] ?? 0) | ((b[29] ?? 0) << 8)) & 0x3fff,
    };
  }
  if (ascii(b, 12, 'VP8L')) {
    if (b[20] !== 0x2f) return null;
    const b1 = b[21] ?? 0;
    const b2 = b[22] ?? 0;
    const b3 = b[23] ?? 0;
    const b4 = b[24] ?? 0;
    return {
      width: 1 + (b1 | ((b2 & 0x3f) << 8)),
      height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)),
    };
  }
  if (ascii(b, 12, 'VP8X')) {
    const le24 = (at: number) =>
      (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8) | ((b[at + 2] ?? 0) << 16);
    return { width: 1 + le24(24), height: 1 + le24(27) };
  }
  return null;
}

/** Check size, real type and dimensions of an uploaded logo. */
export function inspectClientLogo(bytes: Uint8Array): ClientLogoCheck {
  if (bytes.length === 0) return { ok: false, reason: 'empty' };
  if (bytes.length > CLIENT_LOGO_MAX_BYTES) {
    return { ok: false, reason: 'too_large' };
  }

  let type: ClientLogoType;
  let size: Size | null;
  if (
    bytes.length > 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, i) => bytes[i] === value,
    )
  ) {
    type = 'png';
    size = pngSize(bytes);
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    type = 'jpeg';
    size = jpegSize(bytes);
  } else if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) {
    type = 'webp';
    size = webpSize(bytes);
  } else {
    return { ok: false, reason: 'unsupported_type' };
  }

  if (!size) return { ok: false, reason: 'unreadable' };
  const { width, height } = size;
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  if (
    short < CLIENT_LOGO_MIN_SIDE ||
    long > CLIENT_LOGO_MAX_SIDE ||
    long / short > CLIENT_LOGO_MAX_ASPECT
  ) {
    return { ok: false, reason: 'bad_dimensions' };
  }
  return { ok: true, type, mime: CLIENT_LOGO_MIME[type], width, height };
}

export const CLIENT_LOGO_REJECTION_MESSAGE: Record<
  ClientLogoRejection,
  string
> = {
  empty: 'The logo file is empty.',
  too_large: 'The logo must be 512 KB or smaller.',
  unsupported_type: 'The logo must be a PNG, JPEG or WebP image (no SVG).',
  unreadable: 'The logo image could not be read.',
  bad_dimensions:
    'The logo must be roughly square, between 32 and 2048 pixels on each side.',
};

/**
 * A logo is shown to people only once the client is approved: approving the
 * client approves the logo it carries. Anything else is never exposed.
 */
export function visibleClientLogoUrl(client: {
  status: string;
  logoUrl: string | null;
}): string | null {
  if (client.status !== 'approved' || !client.logoUrl) return null;
  return client.logoUrl.startsWith('https://') ? client.logoUrl : null;
}
